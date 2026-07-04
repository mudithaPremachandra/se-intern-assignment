import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server';
import { pool } from '../src/db';
import { ensureTestDatabase, resetDatabase } from './helpers';

const app = buildServer({ logger: false });

beforeAll(async () => {
  await ensureTestDatabase();
  await app.ready();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /tickets', () => {
  it('returns all tickets with assignee name and comment count', async () => {
    const res = await app.inject({ method: 'GET', url: '/tickets' });

    expect(res.statusCode).toBe(200);
    const tickets = res.json();
    expect(tickets).toHaveLength(3);

    const printer = tickets.find((t: any) => t.subject === 'Printer on fire');
    expect(printer).toMatchObject({
      status: 'open',
      priority: 'urgent',
      assigneeName: 'Ada Fixture',
      commentCount: 2,
      slaHours: 4,
      // open, created 2h ago on a 4h SLA → comfortably on track
      slaState: 'ok',
    });
    expect(printer.createdAt).toBeTypeOf('string');
    expect(printer.slaDeadline).toBeTypeOf('string');
    // ~2h left of the 4h window
    expect(printer.slaRemainingSeconds).toBeGreaterThan(6000);
    expect(printer.slaRemainingSeconds).toBeLessThan(8000);

    const unassigned = tickets.find((t: any) => t.subject === 'Unassigned question');
    expect(unassigned.assigneeId).toBeNull();
    expect(unassigned.assigneeName).toBeNull();
    expect(unassigned.commentCount).toBe(0);
  });
});

describe('SLA computation', () => {
  // Insert a ticket with precise timings and read back its computed SLA state.
  async function slaStateFor(subject: string, values: string): Promise<any> {
    await pool.query(
      `insert into tickets (subject, description, status, priority, sla_hours, created_at, updated_at, resolved_at)
       values ($1, 'x', ${values})`,
      [subject]
    );
    const res = await app.inject({ method: 'GET', url: '/tickets' });
    return res.json().find((t: any) => t.subject === subject);
  }

  it('flags an active ticket inside 25% of its window as at_risk', async () => {
    // 4h SLA, created 3.5h ago → 30m left = 12.5% of the window
    const t = await slaStateFor(
      'at risk',
      `'open', 'medium', 4, now() - interval '3 hours 30 minutes', now(), null`
    );
    expect(t.slaState).toBe('at_risk');
    expect(t.slaRemainingSeconds).toBeGreaterThan(0);
  });

  it('flags an active ticket past its deadline as breached', async () => {
    // in_progress keeps the clock live even with no resolved_at
    const t = await slaStateFor(
      'active overdue',
      `'in_progress', 'medium', 4, now() - interval '6 hours', now(), null`
    );
    expect(t.slaState).toBe('breached');
    expect(t.slaRemainingSeconds).toBeLessThan(0);
  });

  it('freezes a ticket resolved before its deadline as met', async () => {
    // 8h SLA, created 10h ago, resolved 2h after creation (8h ago) — within SLA
    const t = await slaStateFor(
      'resolved on time',
      `'resolved', 'medium', 8, now() - interval '10 hours', now() - interval '8 hours', now() - interval '8 hours'`
    );
    expect(t.slaState).toBe('met');
  });

  it('freezes a ticket resolved after its deadline as breached', async () => {
    // 4h SLA, created 10h ago, resolved 5h after creation (5h ago) — overran
    const t = await slaStateFor(
      'resolved late',
      `'resolved', 'medium', 4, now() - interval '10 hours', now() - interval '5 hours', now() - interval '5 hours'`
    );
    expect(t.slaState).toBe('breached');
  });

  it('counts a ticket resolved exactly at its deadline as met', async () => {
    // 8h SLA, created 8h ago, resolved now → resolved_at == deadline (boundary)
    const t = await slaStateFor(
      'resolved on the line',
      `'resolved', 'medium', 8, now() - interval '8 hours', now(), now()`
    );
    expect(t.slaState).toBe('met');
  });

  it('marks a closed ticket with no resolution time as unknown', async () => {
    const t = await slaStateFor(
      'closed no resolution',
      `'closed', 'medium', 8, now() - interval '30 days', now() - interval '28 days', null`
    );
    expect(t.slaState).toBe('unknown');
    expect(t.slaRemainingSeconds).toBeNull();
  });
});

describe('GET /tickets/:id', () => {
  it('returns the ticket with its comments', async () => {
    const res = await app.inject({ method: 'GET', url: '/tickets/1' });

    expect(res.statusCode).toBe(200);
    const ticket = res.json();
    expect(ticket.subject).toBe('Printer on fire');
    expect(ticket.comments).toHaveLength(2);
    expect(ticket.comments[0]).toMatchObject({
      ticketId: 1,
      authorName: 'Grace Fixture',
      body: 'Extinguisher deployed, assessing damage.',
    });
    // SLA fields are computed on the get-by-id path too (open, 4h SLA, 2h old)
    expect(ticket.slaState).toBe('ok');
    expect(ticket.slaDeadline).toBeTypeOf('string');
    expect(ticket.slaRemainingSeconds).toBeGreaterThan(6000);
    expect(ticket.slaRemainingSeconds).toBeLessThan(8000);
  });

  it('returns 404 for an unknown ticket', async () => {
    const res = await app.inject({ method: 'GET', url: '/tickets/999' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Ticket 999 not found' });
  });
});

describe('POST /tickets', () => {
  it('creates a ticket with defaults applied', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tickets',
      payload: {
        subject: 'Keyboard missing keys',
        description: 'The E and R keys have vanished.',
      },
    });

    expect(res.statusCode).toBe(201);
    const ticket = res.json();
    expect(ticket).toMatchObject({
      subject: 'Keyboard missing keys',
      status: 'open',
      priority: 'medium',
      assigneeId: null,
      assigneeName: null,
      slaHours: 8,
      commentCount: 0,
      resolvedAt: null,
      // Exercises the RETURNING path, which builds the SLA columns unqualified
      slaState: 'ok',
    });
    expect(ticket.slaDeadline).toBeTypeOf('string');
    // freshly created on an 8h SLA → the full window (~28800s) remains
    expect(ticket.slaRemainingSeconds).toBeGreaterThan(28000);
    expect(ticket.slaRemainingSeconds).toBeLessThanOrEqual(28800);
  });

  it('rejects an invalid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tickets',
      payload: { subject: '' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Validation failed');
  });
});

describe('PATCH /tickets/:id/status', () => {
  it('updates the status and returns the ticket', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/tickets/1/status',
      payload: { status: 'in_progress' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('in_progress');
  });

  it('rejects an unknown status value', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/tickets/1/status',
      payload: { status: 'archived' },
    });

    expect(res.statusCode).toBe(400);
  });
});

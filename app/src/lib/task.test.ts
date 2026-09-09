import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TASK_POINTS,
  TASK_CATEGORIES,
  groupTasks,
  suggestedTaskPoints,
  taskCapacity,
  taskUrgency,
  validateTask,
  type TaskDraft,
  type TaskWithAssignments,
} from './task';

const NOW = new Date('2026-09-09T12:00:00Z');

function draft(overrides: Partial<TaskDraft> = {}): TaskDraft {
  return {
    title: 'Festbeiz-Bewilligung',
    why: 'Ohne Bewilligung keine Beiz',
    description: '',
    category: 'catering',
    points: 20,
    dueAt: '',
    maxAssignees: 1,
    teamId: null,
    recurrenceDays: null,
    ...overrides,
  };
}

function task(overrides: Partial<TaskWithAssignments> = {}): TaskWithAssignments {
  return {
    id: 'task-1',
    club_id: 'club-1',
    team_id: null,
    title: 'Platz mähen',
    description: null,
    why: 'Damit gespielt werden kann',
    category: 'facility',
    points: 10,
    task_type: 'oneoff',
    due_at: null,
    max_assignees: 1,
    status: 'open',
    is_sample: false,
    recurrence_days: null,
    created_by: 'member-x',
    created_at: NOW.toISOString(),
    assignments: [],
    ...overrides,
  } as TaskWithAssignments;
}

describe('validateTask', () => {
  it('lässt einen Entwurf ohne Warum zu, eine Publikation nicht (A3, BR-069)', () => {
    const withoutWhy = draft({ why: '   ' });

    expect(validateTask(withoutWhy, false, NOW)).not.toContain('whyMissing');
    expect(validateTask(withoutWhy, true, NOW)).toContain('whyMissing');
  });

  it('verlangt für beide Wege einen Titel', () => {
    expect(validateTask(draft({ title: 'A' }), false, NOW)).toContain('titleMissing');
    expect(validateTask(draft({ title: '  ' }), true, NOW)).toContain('titleMissing');
  });

  it('lässt den Punktwert 0 zu – das ist der Nur-Dank-Modus (FR-040)', () => {
    expect(validateTask(draft({ points: 0 }), true, NOW)).toEqual([]);
  });

  it('weist einen negativen Punktwert ab (Constraint aus 0033)', () => {
    expect(validateTask(draft({ points: -1 }), true, NOW)).toContain('pointsNegative');
  });

  it('verlangt mindestens eine übernehmende Person', () => {
    expect(validateTask(draft({ maxAssignees: 0 }), true, NOW)).toContain(
      'assigneesTooLow',
    );
  });

  it('weist eine Frist in der Vergangenheit ab', () => {
    expect(validateTask(draft({ dueAt: '2026-09-08T10:00' }), true, NOW)).toContain(
      'dueInPast',
    );
    expect(validateTask(draft({ dueAt: '2026-09-30T10:00' }), true, NOW)).toEqual([]);
  });

  it('lässt eine Aufgabe ohne Frist zu – nicht jede Hilfe hat einen Termin', () => {
    expect(validateTask(draft({ dueAt: '' }), true, NOW)).toEqual([]);
  });

  it('begrenzt den Rhythmus auf einen Tag bis zwei Jahre (A2)', () => {
    expect(validateTask(draft({ recurrenceDays: 0 }), true, NOW)).toContain(
      'recurrenceOutOfRange',
    );
    expect(validateTask(draft({ recurrenceDays: 731 }), true, NOW)).toContain(
      'recurrenceOutOfRange',
    );
    expect(validateTask(draft({ recurrenceDays: 14 }), true, NOW)).toEqual([]);
  });
});

describe('suggestedTaskPoints', () => {
  it('nimmt den Wert der Vereinsregel «task_done» (UC-016)', () => {
    expect(suggestedTaskPoints([{ code: 'task_done', points: 35 }])).toBe(35);
  });

  it('fällt auf den Vorgabewert zurück, wenn der Verein keine Regel hat', () => {
    expect(suggestedTaskPoints([{ code: 'training_attend', points: 5 }])).toBe(
      DEFAULT_TASK_POINTS,
    );
    expect(suggestedTaskPoints(undefined)).toBe(DEFAULT_TASK_POINTS);
  });

  it('übernimmt auch eine Regel im Nur-Dank-Modus, statt sie zu übergehen', () => {
    // 0 ist ein gültiger Wert und keine fehlende Angabe (FR-040).
    expect(suggestedTaskPoints([{ code: 'task_done', points: 0 }])).toBe(0);
  });
});

describe('taskUrgency', () => {
  it('nennt eine Aufgabe ohne Frist nie dringend (BR-072)', () => {
    expect(taskUrgency(null, NOW)).toBe('none');
  });

  it('hebt eine Frist innerhalb von zwei Tagen hervor', () => {
    expect(taskUrgency('2026-09-10T12:00:00Z', NOW)).toBe('urgent');
    expect(taskUrgency('2026-09-11T11:00:00Z', NOW)).toBe('urgent');
  });

  it('lässt eine weiter entfernte Frist ruhig', () => {
    expect(taskUrgency('2026-09-20T12:00:00Z', NOW)).toBe('later');
  });

  it('erkennt die abgelaufene Frist (A4)', () => {
    expect(taskUrgency('2026-09-09T11:59:00Z', NOW)).toBe('expired');
  });

  it('behandelt eine unlesbare Frist wie keine, statt zu stürzen', () => {
    expect(taskUrgency('kein Datum', NOW)).toBe('none');
  });
});

describe('taskCapacity', () => {
  it('zählt jede Übernahme, auch die eingereichte (BR-073)', () => {
    const result = taskCapacity(
      task({
        max_assignees: 3,
        assignments: [
          { member_id: 'a', submitted_at: null },
          { member_id: 'b', submitted_at: NOW.toISOString() },
        ] as TaskWithAssignments['assignments'],
      }),
    );

    expect(result).toEqual({ taken: 2, open: 1, isFull: false });
  });

  it('meldet voll, sobald die Höchstzahl erreicht ist (A1 aus UC-018)', () => {
    const result = taskCapacity(
      task({
        max_assignees: 1,
        assignments: [{ member_id: 'a' }] as TaskWithAssignments['assignments'],
      }),
    );

    expect(result.isFull).toBe(true);
    expect(result.open).toBe(0);
  });
});

describe('groupTasks', () => {
  it('stellt die eigene Übernahme über das Angebot', () => {
    const mine = task({
      id: 'mine',
      status: 'claimed',
      assignments: [{ member_id: 'me' }] as TaskWithAssignments['assignments'],
    });

    const groups = groupTasks([mine], 'me', NOW);

    expect(groups.mine.map((entry) => entry.id)).toEqual(['mine']);
    expect(groups.open).toEqual([]);
  });

  it('zeigt eine vergebene Aufgabe niemand anderem mehr an (BR-073)', () => {
    const taken = task({
      id: 'taken',
      max_assignees: 1,
      assignments: [{ member_id: 'someone' }] as TaskWithAssignments['assignments'],
    });

    const groups = groupTasks([taken], 'me', NOW);

    expect(groups.open).toEqual([]);
    expect(groups.urgent).toEqual([]);
  });

  it('lässt eine Aufgabe mit freiem Platz im Angebot (A2 aus UC-018)', () => {
    const partly = task({
      id: 'partly',
      max_assignees: 2,
      assignments: [{ member_id: 'someone' }] as TaskWithAssignments['assignments'],
    });

    expect(groupTasks([partly], 'me', NOW).open.map((e) => e.id)).toEqual(['partly']);
  });

  it('trennt Drängendes vom Übrigen (BR-072)', () => {
    const soon = task({ id: 'soon', due_at: '2026-09-10T09:00:00Z' });
    const later = task({ id: 'later', due_at: '2026-09-25T09:00:00Z' });

    const groups = groupTasks([soon, later], 'me', NOW);

    expect(groups.urgent.map((e) => e.id)).toEqual(['soon']);
    expect(groups.open.map((e) => e.id)).toEqual(['later']);
  });

  it('sammelt Entwürfe getrennt und zeigt sie in keinem anderen Abschnitt (A3)', () => {
    const asDraft = task({ id: 'draft', status: 'draft' });

    const groups = groupTasks([asDraft], 'me', NOW);

    expect(groups.drafts.map((e) => e.id)).toEqual(['draft']);
    expect(groups.open).toEqual([]);
    expect(groups.urgent).toEqual([]);
    expect(groups.mine).toEqual([]);
  });

  it('hält abgelaufene Aufgaben getrennt, statt sie zu verschweigen (A4)', () => {
    // Die Ablauf-Meldung verlinkt die Aufgabe – sie muss irgendwo stehen.
    const gone = task({ id: 'gone', status: 'expired', due_at: '2026-09-01T09:00:00Z' });

    const groups = groupTasks([gone], 'me', NOW);

    expect(groups.expired.map((e) => e.id)).toEqual(['gone']);
    expect(groups.urgent).toEqual([]);
    expect(groups.open).toEqual([]);
  });

  it('lässt eingereichte Aufgaben Fremder aus dem Angebot', () => {
    const submitted = task({
      id: 'submitted',
      status: 'submitted',
      assignments: [{ member_id: 'someone' }] as TaskWithAssignments['assignments'],
    });

    const groups = groupTasks([submitted], 'me', NOW);

    expect(groups.open).toEqual([]);
    expect(groups.mine).toEqual([]);
  });

  it('kennt jede Kategorie der Datenbank – sonst zeigt der Marktplatz einen Schlüssel', () => {
    expect(TASK_CATEGORIES).toHaveLength(8);
    expect(TASK_CATEGORIES).toContain('other');
  });
});

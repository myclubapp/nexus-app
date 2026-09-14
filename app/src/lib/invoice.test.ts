import { describe, expect, it } from 'vitest';
import {
  INVOICE_STATUSES,
  openTotal,
  sortInvoices,
  statusTone,
  wasOnTime,
  type InvoiceRef,
} from './invoice';

function invoice(overrides: Partial<InvoiceRef> = {}): InvoiceRef {
  return {
    id: 'i-1',
    amount: 120,
    dueDate: '2026-09-30',
    status: 'open',
    paidAt: null,
    detailUrl: null,
    pdfPath: null,
    ...overrides,
  };
}

describe('INVOICE_STATUSES', () => {
  it('führt die Werte des Entitätsmodells, nicht die der alten App', () => {
    // Die bestehende myclub-App kennt `draft`, `send`, `sent` und `bezahlt` –
    // der letzte deutsch mitten in englischen Werten. Hier sind es drei
    // englische, und der Spiegel kennt keinen Entwurf: Was nicht gestellt ist,
    // geht die App nichts an (BR-156).
    expect([...INVOICE_STATUSES]).toEqual(['open', 'paid', 'overdue']);
  });
});

describe('wasOnTime', () => {
  it('zählt die Zahlung am Fälligkeitstag als pünktlich (BR-157)', () => {
    expect(
      wasOnTime(invoice({ status: 'paid', paidAt: '2026-09-30T23:59:00Z' })),
    ).toBe(true);
  });

  it('zählt einen Tag danach nicht mehr', () => {
    expect(
      wasOnTime(invoice({ status: 'paid', paidAt: '2026-10-01T00:01:00Z' })),
    ).toBe(false);
  });

  it('zählt früher natürlich auch', () => {
    expect(
      wasOnTime(invoice({ status: 'paid', paidAt: '2026-09-01T10:00:00Z' })),
    ).toBe(true);
  });

  it('sagt zu einer offenen Rechnung nichts', () => {
    expect(wasOnTime(invoice({ status: 'open' }))).toBe(false);
    expect(wasOnTime(invoice({ status: 'overdue' }))).toBe(false);
    // Bezahlt ohne Zeitpunkt kann es nicht geben – der Constraint in `0054`
    // schliesst es aus. Falls doch, wird nichts behauptet.
    expect(wasOnTime(invoice({ status: 'paid', paidAt: null }))).toBe(false);
  });
});

describe('statusTone', () => {
  it('gibt Verzug **kein** Rot (BR-158)', () => {
    // Keine Sanktion bei Verzug: Es ist ein Anlass für Kontakt, kein Vergehen.
    // Ein rotes Abzeichen wäre die Sanktion, die die Regel ausschliesst.
    expect(statusTone('overdue')).toBe('warning');
    expect(statusTone('overdue')).not.toBe('danger');
  });

  it('würdigt die bezahlte Rechnung', () => {
    expect(statusTone('paid')).toBe('success');
  });

  it('lässt die offene neutral', () => {
    expect(statusTone('open')).toBe('medium');
  });
});

describe('sortInvoices', () => {
  it('stellt nach oben, was zu tun ist', () => {
    const rows = [
      invoice({ id: 'a', status: 'paid', dueDate: '2026-01-01', paidAt: '2025-12-01T00:00:00Z' }),
      invoice({ id: 'b', status: 'open', dueDate: '2026-10-01' }),
      invoice({ id: 'c', status: 'overdue', dueDate: '2026-08-01' }),
    ];

    expect(sortInvoices(rows).map((row) => row.id)).toEqual(['c', 'b', 'a']);
  });

  it('ordnet innerhalb eines Standes nach Fälligkeit', () => {
    const rows = [
      invoice({ id: 'spät', dueDate: '2026-12-01' }),
      invoice({ id: 'früh', dueDate: '2026-10-01' }),
    ];

    expect(sortInvoices(rows).map((row) => row.id)).toEqual(['früh', 'spät']);
  });

  it('lässt die übergebene Liste unberührt', () => {
    const rows = [invoice({ id: 'a', status: 'paid', paidAt: '2026-01-01T00:00:00Z' }), invoice({ id: 'b' })];
    sortInvoices(rows);
    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
  });
});

describe('openTotal', () => {
  it('zählt offene und überfällige zusammen', () => {
    expect(
      openTotal([
        invoice({ amount: 120, status: 'open' }),
        invoice({ amount: 80, status: 'overdue' }),
        invoice({ amount: 999, status: 'paid', paidAt: '2026-01-01T00:00:00Z' }),
      ]),
    ).toBe(200);
  });

  it('ist ohne Rechnungen null', () => {
    expect(openTotal([])).toBe(0);
  });
});

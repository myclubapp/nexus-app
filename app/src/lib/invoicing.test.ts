import { describe, expect, it } from 'vitest';
import {
  creditorProblems,
  formatQrReference,
  isQrIban,
  isValidIban,
  periodTotals,
  positionsFor,
  qrCheckDigit,
  stateTone,
  totalFor,
} from './invoicing';
import type { Invoice, InvoiceFeeItem } from './database.types';

function feeItem(overrides: Partial<InvoiceFeeItem> = {}): InvoiceFeeItem {
  return {
    id: crypto.randomUUID(),
    club_id: 'club',
    team_id: null,
    name: 'Jahresbeitrag',
    amount: 120,
    currency: 'CHF',
    is_active: true,
    created_at: '2026-09-14T10:00:00Z',
    ...overrides,
  } as InvoiceFeeItem;
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: crypto.randomUUID(),
    club_id: 'club',
    period_id: 'period',
    member_id: 'member',
    reference: '210000000003139471430009017',
    amount: 100,
    currency: 'CHF',
    status: 'sent',
    due_date: '2026-10-31',
    pdf_path: null,
    sent_at: null,
    paid_at: null,
    payer: null,
    cancelled_at: null,
    cancel_reason: null,
    created_at: '2026-09-14T10:00:00Z',
    updated_at: '2026-09-14T10:00:00Z',
    ...overrides,
  } as Invoice;
}

describe('isValidIban', () => {
  it('nimmt eine gültige IBAN an', () => {
    expect(isValidIban('CH93 0076 2011 6238 5295 7')).toBe(true);
    expect(isValidIban('DE89370400440532013000')).toBe(true);
  });

  it('weist eine falsche Prüfziffer ab', () => {
    expect(isValidIban('CH9300762011623852958')).toBe(false);
  });

  it('weist ab, was keine IBAN ist', () => {
    expect(isValidIban('')).toBe(false);
    expect(isValidIban('12345')).toBe(false);
    expect(isValidIban('CHF 100.00')).toBe(false);
  });
});

describe('isQrIban', () => {
  it('erkennt die QR-IID 30000 bis 31999', () => {
    // Beispiel aus den SIX-Guidelines.
    expect(isQrIban('CH44 3199 9123 0008 8901 2')).toBe(true);
  });

  it('eine gewöhnliche IBAN ist keine QR-IBAN', () => {
    // Sie ist gültig – trägt aber keine QRR-Referenz, und ohne die liesse sich
    // ein Zahlungseingang nicht zuordnen (UC-047).
    expect(isValidIban('CH9300762011623852957')).toBe(true);
    expect(isQrIban('CH9300762011623852957')).toBe(false);
  });
});

describe('qrCheckDigit', () => {
  it('rechnet die Beispiele der SIX-Guidelines', () => {
    // Dieselben zwei Beispiele belegen `qr_check_digit()` in `0087`.
    expect(qrCheckDigit('21000000000313947143000901')).toBe(7);
    expect(qrCheckDigit('96111690000000660000000094')).toBe(2);
  });

  it('weist eine Basis ab, die keine Ziffernfolge ist', () => {
    expect(() => qrCheckDigit('12a')).toThrow();
  });
});

describe('formatQrReference', () => {
  it('gruppiert von rechts in Fünfern', () => {
    expect(formatQrReference('210000000003139471430009017')).toBe(
      '21 00000 00003 13947 14300 09017',
    );
  });

  it('lässt Leerzeichen in der Eingabe zu', () => {
    expect(formatQrReference('21 00000 00003 13947 14300 09017')).toBe(
      '21 00000 00003 13947 14300 09017',
    );
  });
});

describe('positionsFor', () => {
  const clubFee = feeItem({ name: 'Mitgliederbeitrag', amount: 80 });
  const teamFee = feeItem({ name: 'Herren 1', amount: 200, team_id: 'team-1' });
  const otherTeamFee = feeItem({ name: 'Junioren', amount: 120, team_id: 'team-2' });
  const inactive = feeItem({ name: 'Altlast', amount: 50, is_active: false });

  it('nimmt Vereinspositionen für jede Person', () => {
    expect(positionsFor([clubFee], [])).toEqual([clubFee]);
  });

  it('nimmt den Beitrag nur für Mitglieder dieses Teams', () => {
    expect(positionsFor([teamFee, otherTeamFee], ['team-1'])).toEqual([teamFee]);
  });

  it('lässt abgeschaltete Positionen liegen', () => {
    expect(positionsFor([inactive], [])).toEqual([]);
  });

  it('summiert, was zusammenkommt', () => {
    expect(totalFor([clubFee, teamFee, otherTeamFee, inactive], ['team-1'])).toBe(280);
  });

  it('ein Abzug zieht ab', () => {
    const discount = feeItem({ name: 'Familienrabatt', amount: -30 });
    expect(totalFor([clubFee, discount], [])).toBe(50);
  });
});

describe('stateTone', () => {
  const today = '2026-11-01';

  it('bezahlt ist grün', () => {
    expect(stateTone('paid', '2026-10-31', today)).toBe('success');
  });

  it('überfällig ist warnend, nicht gefährlich (BR-158)', () => {
    expect(stateTone('sent', '2026-10-31', today)).toBe('warning');
  });

  it('versendet und noch nicht fällig ist neutral', () => {
    expect(stateTone('sent', '2026-12-31', today)).toBe('primary');
  });

  it('Entwurf und Storno sind zurückhaltend', () => {
    expect(stateTone('draft', '2026-10-01', today)).toBe('medium');
    expect(stateTone('cancelled', '2026-10-01', today)).toBe('medium');
  });
});

describe('periodTotals', () => {
  it('zählt Entwürfe nicht zum offenen Betrag (BR-226)', () => {
    // Ein Entwurf ist eine Überlegung des Vorstands, keine Forderung – sonst
    // zeigte die Periode Geld, das niemand schuldet.
    const totals = periodTotals([
      invoice({ status: 'draft', amount: 500 }),
      invoice({ status: 'sent', amount: 100 }),
      invoice({ status: 'sent', amount: 50 }),
      invoice({ status: 'paid', amount: 200 }),
      invoice({ status: 'cancelled', amount: 999 }),
    ]);

    expect(totals.draft).toBe(1);
    expect(totals.sent).toBe(2);
    expect(totals.paid).toBe(1);
    expect(totals.cancelled).toBe(1);
    expect(totals.open).toBe(150);
    expect(totals.received).toBe(200);
  });

  it('ohne Rechnungen ist alles null', () => {
    expect(periodTotals([])).toEqual({
      draft: 0,
      sent: 0,
      paid: 0,
      cancelled: 0,
      open: 0,
      received: 0,
    });
  });
});

describe('creditorProblems', () => {
  const complete = {
    iban: 'CH4431999123000889012',
    name: 'Turnverein Beispiel',
    street: 'Hauptstrasse 1',
    postal_code: '8200',
    city: 'Schaffhausen',
  };

  it('nennt nichts, wenn alles steht', () => {
    expect(creditorProblems(complete)).toEqual([]);
  });

  it('nennt die fehlende Zeile', () => {
    expect(creditorProblems(null)).toEqual(['missing']);
    expect(creditorProblems({ ...complete, city: '  ' })).toEqual(['city']);
  });

  it('unterscheidet ungültig von «keine QR-IBAN»', () => {
    // Der Unterschied ist für die Kassier:in entscheidend: Das eine ist ein
    // Tippfehler, das andere ein Gang zur Bank.
    expect(creditorProblems({ ...complete, iban: 'CH9300762011623852958' })).toEqual([
      'ibanInvalid',
    ]);
    expect(creditorProblems({ ...complete, iban: 'CH9300762011623852957' })).toEqual([
      'ibanNotQr',
    ]);
  });
});

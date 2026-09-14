/**
 * Die Abbildung der alten App auf Termine (UC-040) – `deno test` in diesem Ordner.
 */
import { assertEquals, assertStrictEquals } from 'jsr:@std/assert@1';
import { gameExternalId, isCurrent, isCurrentGame, isCurrentTraining, mapEvent, mapMember, mapResponse, mapShift, mapTeam, mapTraining, readLocation, shiftTimeToIso, type LegacyDoc } from './mapping.ts';

const NOW = new Date('2026-09-12T10:00:00Z');

function helper(overrides: Partial<LegacyDoc> = {}): LegacyDoc {
  return {
    id: 'abc123',
    name: 'Heimrunde Herren GF 2.Liga',
    description: 'Kadetten UH Schaffhausen – UHC Wängi',
    location: 'BBC Arena',
    streetAndNumber: 'Hohbergstrasse 1',
    postalCode: '8200',
    city: 'Schaffhausen',
    date: '2026-10-17T16:45:00Z',
    timeFrom: '2026-10-17T16:45:00.000Z',
    timeTo: '2026-10-17T20:30:00.000Z',
    countNeeded: 0,
    cancelled: false,
    ...overrides,
  };
}

Deno.test('isCurrent: die Grenze der alten App – zwei Stunden nach Beginn', () => {
  assertEquals(isCurrent(helper({ timeFrom: '2026-09-12T08:00:00Z' }), NOW), true);
  assertEquals(isCurrent(helper({ timeFrom: '2026-09-12T07:59:00Z' }), NOW), false);
  assertEquals(isCurrent(helper({ timeFrom: 'kaputt', date: undefined, startDate: undefined }), NOW), false);
});

Deno.test('readLocation: eine Zeile, ohne Leerteile und ohne Doppelung', () => {
  assertEquals(readLocation(helper()), 'BBC Arena, Hohbergstrasse 1, 8200 Schaffhausen');
  assertEquals(readLocation(helper({ streetAndNumber: '', postalCode: '', city: '' })), 'BBC Arena');
  assertEquals(readLocation(helper({ location: 'Schaffhausen', streetAndNumber: '', postalCode: '', city: 'Schaffhausen' })), 'Schaffhausen');
  assertStrictEquals(readLocation(helper({ location: '', streetAndNumber: '', postalCode: '', city: '' })), null);
});

Deno.test('shiftTimeToIso: Uhrzeit in Zürcher Ortszeit am Tag des Termins', () => {
  // Oktober: Sommerzeit, 18:45 Zürich = 16:45Z.
  assertEquals(shiftTimeToIso('18:45', '2026-10-17T16:45:00Z'), '2026-10-17T16:45:00.000Z');
  // November: Winterzeit, 17:15 Zürich = 16:15Z.
  assertEquals(shiftTimeToIso('17:15', '2025-11-16T16:15:00Z'), '2025-11-16T16:15:00.000Z');
  // Der Termin beginnt um 23:30Z – in Zürich ist das schon der nächste Tag.
  assertEquals(shiftTimeToIso('08:00', '2026-07-01T23:30:00Z'), '2026-07-02T06:00:00.000Z');
  assertStrictEquals(shiftTimeToIso('', '2026-10-17T16:45:00Z'), null);
  assertStrictEquals(shiftTimeToIso('25:00', '2026-10-17T16:45:00Z'), null);
});

Deno.test('mapShift: Zeiten und Bedarf; der fremde Punktwert wird nicht übernommen', () => {
  const shift = mapShift(
    { id: 'Lk0a', name: 'Banden', timeFrom: '18:45', timeTo: '22:30', countNeeded: 2, points: 1 },
    '2026-10-17T16:45:00Z',
  );
  // BR-204: kein `points` im Ergebnis. Der Wert 1 der alten App wäre in dieser
  // Skala ein Achtzigstel eines halben Tages; `upsert_legacy_event()` rechnet
  // ihn aus der Dauer.
  assertEquals(shift, {
    external_id: 'Lk0a',
    title: 'Banden',
    starts_at: '2026-10-17T16:45:00.000Z',
    ends_at: '2026-10-17T20:30:00.000Z',
    needed: 2,
  });
  assertStrictEquals((shift as unknown as Record<string, unknown>).points, undefined);
});

Deno.test('mapShift: vertauschte Zeiten werden getauscht, fehlende Dauer wird zwei Stunden', () => {
  const swapped = mapShift({ id: '1', name: 'Spielsekretär', timeFrom: '21:30', timeTo: '20:30' }, '2025-11-16T16:15:00Z');
  assertEquals(swapped.starts_at, '2025-11-16T19:30:00.000Z');
  assertEquals(swapped.ends_at, '2025-11-16T20:30:00.000Z');

  const noEnd = mapShift({ id: '2', name: 'Helfer', timeFrom: '19:15' }, '2026-01-03T18:15:00Z');
  assertEquals(noEnd.starts_at, '2026-01-03T18:15:00.000Z');
  assertEquals(noEnd.ends_at, '2026-01-03T20:15:00.000Z');

  const noTimes = mapShift({ id: '3', name: '', countNeeded: 0, points: -3 }, '2026-01-03T18:15:00Z');
  assertEquals(noTimes.title, 'Schicht');
  assertEquals(noTimes.needed, 1);
  assertStrictEquals((noTimes as unknown as Record<string, unknown>).points, undefined);
  assertEquals(noTimes.starts_at, '2026-01-03T18:15:00.000Z');
});

Deno.test('mapEvent: ein Helfer-Event mit Schichten', () => {
  const event = mapEvent(helper(), 'helper', [
    { id: 'a', name: 'Kiosk', timeFrom: '18:45', timeTo: '22:30', countNeeded: 2, points: 1 },
  ]);
  assertEquals(event?.external_id, 'legacy:helper:abc123');
  assertEquals(event?.type, 'helper');
  assertEquals(event?.title, 'Heimrunde Herren GF 2.Liga');
  assertEquals(event?.why, 'Kadetten UH Schaffhausen – UHC Wängi');
  assertEquals(event?.starts_at, '2026-10-17T16:45:00.000Z');
  assertEquals(event?.ends_at, '2026-10-17T20:30:00.000Z');
  assertEquals(event?.capacity_needed, null);
  assertEquals(event?.cancelled, false);
  assertEquals(event?.shifts.length, 1);
  assertEquals(event?.shifts[0].title, 'Kiosk');
});

Deno.test('mapEvent: ein Anlass wird social, ohne Schichten, mit Bedarf und Absage', () => {
  const event = mapEvent(
    helper({ id: 'x1', name: 'Grümpelturnier', description: '', countNeeded: 12, cancelled: true, cancelledReason: 'Halle belegt' }),
    'event',
    [{ id: 'ignored', name: 'Kiosk' }],
  );
  assertEquals(event?.external_id, 'legacy:event:x1');
  assertEquals(event?.type, 'social');
  assertEquals(event?.why, null);
  assertEquals(event?.capacity_needed, 12);
  assertEquals(event?.cancelled, true);
  assertEquals(event?.cancelled_reason, 'Halle belegt');
  assertEquals(event?.shifts, []);
});

Deno.test('mapEvent: Ende vor Beginn wird kein Ende; ohne Titel oder Zeit kein Termin', () => {
  assertEquals(mapEvent(helper({ timeTo: '2026-10-17T16:45:00.000Z' }), 'helper')?.ends_at, null);
  assertStrictEquals(mapEvent(helper({ name: '  ' }), 'helper'), null);
  assertStrictEquals(mapEvent(helper({ timeFrom: '', date: '', startDate: '' }), 'helper'), null);
  // Ohne `timeFrom` zählt `date`.
  assertEquals(mapEvent(helper({ timeFrom: '' }), 'helper')?.starts_at, '2026-10-17T16:45:00.000Z');
});

Deno.test('mapTraining: Tag aus date, Uhrzeit aus der Serienvorlage – in Zürcher Ortszeit', () => {
  // date 17.11. 18:30Z (Winter), timeFrom 6.10. 18:30Z (Sommer = 20:30 Zürich), timeTo 20:15Z (Sommer = 22:15 Zürich)
  const training = mapTraining(
    { id: 'tr1', name: 'Herren 2 GF Training', date: '2026-11-17T18:30:00Z', timeFrom: '2026-10-06T18:30:00.000Z', timeTo: '2027-03-30T20:15:00.000Z', location: 'BBC Arena', cancelled: false },
    'su-432367',
  );
  assertEquals(training?.external_id, 'legacy:training:tr1');
  assertEquals(training?.type, 'training');
  assertEquals(training?.team_legacy_id, 'su-432367');
  // 20:30 Zürich am 17.11. (Winter) = 19:30Z; 22:15 Zürich = 21:15Z
  assertEquals(training?.starts_at, '2026-11-17T19:30:00.000Z');
  assertEquals(training?.ends_at, '2026-11-17T21:15:00.000Z');
  assertEquals(training?.why, null);
  assertEquals(training?.shifts, []);
});

Deno.test('isCurrentTraining zählt den Tag des Trainings, nicht die Vorlage', () => {
  const now = new Date('2026-09-12T10:00:00Z');
  assertEquals(isCurrentTraining({ id: 't', date: '2026-12-10T18:30:00Z', timeFrom: '2026-06-04T18:30:00.000Z' }, now), true);
  assertEquals(isCurrentTraining({ id: 't', date: '2026-06-04T18:30:00Z', timeFrom: '2026-12-10T18:30:00.000Z' }, now), false);
});

Deno.test('mapMember, mapTeam, mapResponse, gameExternalId', () => {
  assertEquals(
    mapMember({ id: 'uid1', firstName: ' Raphael', lastName: 'Fürst', roles: ['Vorstand', ''] }, { id: 'uid1', email: 'R@Example.ch' }),
    { legacy_user_id: 'uid1', first_name: 'Raphael', last_name: 'Fürst', email: 'r@example.ch', roles: ['Vorstand'] },
  );
  assertEquals(mapMember({ id: 'uid2' }, null).email, null);

  assertEquals(mapTeam({ id: 'su-432367', name: 'Herren GF 4. Liga II', type: 'swissunihockey', externalId: '432367' }, [{ id: 'a' }, { id: 'b' }]), {
    legacy_team_id: 'su-432367', name: 'Herren GF 4. Liga II', federation_team_id: '432367', member_ids: ['a', 'b'],
  });
  assertEquals(mapTeam({ id: 'B8lJPtnXh3W1frLc7AFX', name: 'Junioren U13', type: 'swissunihockey', externalId: '' }, [])?.federation_team_id, null);
  assertStrictEquals(mapTeam({ id: 'x' }, []), null);

  assertEquals(mapResponse({ id: 'uid1', status: true, changedAt: '2026-09-04T07:54:54.627Z' }, 'legacy:helper:h1', 's1'), {
    event_external_id: 'legacy:helper:h1', shift_external_id: 's1', legacy_user_id: 'uid1', status: true, changed_at: '2026-09-04T07:54:54.627Z',
  });
  assertEquals(mapResponse({ id: 'uid1', status: false }, 'swissunihockey:1', null)?.status, false);
  assertStrictEquals(mapResponse({ id: 'uid1', status: 'ja' }, 'x'), null);

  assertEquals(gameExternalId({ id: 'su-1102913', externalId: '1102913' }), 'swissunihockey:1102913');
  assertEquals(gameExternalId({ id: 'su-7' }), 'swissunihockey:7');
  assertStrictEquals(gameExternalId({ id: 'abc' }), null);
  assertEquals(isCurrentGame({ id: 'g', dateTime: '2026-09-20T09:55:00Z' }, new Date('2026-09-12T10:00:00Z')), true);
});

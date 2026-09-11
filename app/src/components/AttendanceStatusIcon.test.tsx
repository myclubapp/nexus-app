import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { AttendanceStatusIcon, nextResponse, statusLook } from './AttendanceStatusIcon';
import { renderWithProviders } from '../test/utils';

/**
 * Das Ampel-Symbol der bestehenden myclub-App: Wer die alte App kennt, liest
 * den Stand an Farbe und Form. Die Zuordnung ist deshalb festgehalten.
 */
describe('statusLook', () => {
  it('zeigt die Ampel der alten App', () => {
    expect(statusLook(null).color).toBe('warning');
    expect(statusLook('registered').color).toBe('success');
    expect(statusLook('present').color).toBe('success');
    expect(statusLook('excused').color).toBe('danger');
    expect(statusLook('absent').color).toBe('danger');
  });

  it('überstimmt jeden Stand mit der Absage des Termins', () => {
    expect(statusLook('registered', { isCancelled: true }).labelKey).toBe('cancelled');
  });

  it('meldet einen begonnenen Termin nur ohne Antwort als geschlossen', () => {
    expect(statusLook(null, { isLocked: true }).labelKey).toBe('locked');
    // Wer geantwortet hat, sieht auch danach seine Antwort.
    expect(statusLook('registered', { isLocked: true }).labelKey).toBe('registered');
  });
});

describe('nextResponse', () => {
  it('schaltet zur Gegenantwort um', () => {
    expect(nextResponse(null)).toBe('registered');
    expect(nextResponse('excused')).toBe('registered');
    expect(nextResponse('registered')).toBe('excused');
    expect(nextResponse('present')).toBe('excused');
  });
});

describe('AttendanceStatusIcon', () => {
  it('ist ein Knopf, der beim Tippen zur Gegenantwort wechselt', () => {
    const onToggle = vi.fn();
    const { container } = renderWithProviders(
      <AttendanceStatusIcon status={null} onToggle={onToggle} />,
    );

    // `ion-button` hat in jsdom keine ARIA-Rolle (docs/TESTING.md §1) – gesucht
    // wird über die Beschriftung, die ein Screenreader vorliest.
    const button = container.querySelector(
      'ion-button[aria-label="Noch offen – tippen zum Zusagen"]',
    );
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    expect(onToggle).toHaveBeenCalledWith('registered');
  });

  it('ist nach der Absage des Termins nur noch Anzeige', () => {
    const onToggle = vi.fn();
    const { container } = renderWithProviders(
      <AttendanceStatusIcon status="registered" isCancelled onToggle={onToggle} />,
    );

    expect(container.querySelector('ion-button')).toBeNull();
    expect(screen.getByRole('img', { name: 'Termin abgesagt' })).toBeTruthy();
  });

  it('zeigt einem Nichtbetroffenen «nicht für dich»', () => {
    renderWithProviders(<AttendanceStatusIcon status={null} isAffected={false} />);

    expect(screen.getByRole('img', { name: 'Nicht für dich' })).toBeTruthy();
  });
});

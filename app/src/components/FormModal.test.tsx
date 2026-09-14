import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { FormModal } from './FormModal';
import { renderWithProviders } from '../test/utils';

/**
 * `IonModal` rendert seinen Inhalt in jsdom nicht (docs/TESTING.md, Nr. 5).
 * Hier wird nur die Hülle durchsichtig; Kopfzeile, Inhalt und Knöpfe bleiben
 * die echten Ionic-Elemente, damit der Ort der Bestätigung prüfbar ist.
 */
vi.mock('@ionic/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ionic/react')>();
  return {
    ...actual,
    IonModal: ({ isOpen, children }: { isOpen?: boolean; children?: ReactNode }) =>
      isOpen ? <div data-testid="sheet">{children}</div> : null,
  };
});

/**
 * Wo die Bestätigung steht (guidelines.md §2): rechts in der Kopfzeile, oder
 * mit `submitPlacement="content"` als Block-Knopf am Ende des Inhalts – nie
 * an beiden Stellen.
 */
describe('FormModal – Ort der Bestätigung', () => {
  it('stellt die Bestätigung standardmässig rechts in die Kopfzeile', () => {
    renderWithProviders(
      <FormModal isOpen title="Termin" submitLabel="Erstellen" onSubmit={vi.fn()} onDismiss={vi.fn()}>
        <p>Felder</p>
      </FormModal>,
    );

    const submit = screen.getByText('Erstellen');
    expect(submit.closest('ion-header')).not.toBeNull();
    expect(submit.closest('ion-content')).toBeNull();
    expect(screen.getByText('Abbrechen').closest('ion-header')).not.toBeNull();
  });

  it('stellt die Bestätigung mit submitPlacement="content" ans Ende des Inhalts', () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <FormModal
        isOpen
        title="Absagen"
        submitLabel="Absage senden"
        submitPlacement="content"
        onSubmit={onSubmit}
        onDismiss={vi.fn()}
      >
        <p>Gründe</p>
      </FormModal>,
    );

    const submit = screen.getByText('Absage senden');
    expect(submit.closest('ion-content')).not.toBeNull();
    expect(submit.closest('ion-header')).toBeNull();
    // Der Knopf kommt nach dem Inhalt, nicht davor.
    expect(screen.getByText('Gründe').compareDocumentPosition(submit)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    // Abbrechen bleibt links in der Kopfzeile; rechts steht nichts.
    const header = screen.getByText('Abbrechen').closest('ion-header');
    expect(header).not.toBeNull();
    expect(header!.querySelector('ion-buttons[slot="end"]')).toBeNull();

    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

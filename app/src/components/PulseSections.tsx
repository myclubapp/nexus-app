import { IonItem, IonLabel, IonNote } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { ListSection } from './ListSection';
import { TextSection } from './TextSection';
import { formatDate } from '../lib/format';
import {
  PULSE_SECTIONS,
  externalUrl,
  signatureOf,
  type PulseGreeting,
  type PulseItem,
  type PulseSection,
} from '../lib/pulse';

interface PulseSectionsProps {
  intro?: string | null;
  sections: Record<PulseSection, PulseItem[]>;
  greeting?: PulseGreeting | null;
}

/**
 * Der Inhalt eines Vereins-Pulses: Einleitung, die drei Fragen, der Gruss.
 *
 * **Ein Bauteil für zwei Stellen** – die Leseansicht des Mitglieds (UC-027 A4)
 * und die Vorschau des Vorstands (UC-050 FR-189). Zwei Abschriften würden
 * auseinanderlaufen, und dann zeigte die Vorschau etwas, das niemand bekommt.
 *
 * BR-113: Die Reihenfolge der Abschnitte kommt aus `PULSE_SECTIONS` und nicht
 * aus dieser Ansicht. Ein leerer Abschnitt bekommt keine Überschrift – eine
 * Überschrift ohne Inhalt ist eine Frage ohne Antwort.
 */
export function PulseSections({ intro, sections, greeting }: PulseSectionsProps) {
  const { t } = useTranslation();
  const signature = signatureOf(greeting ?? null);

  return (
    <>
      {/* Die Einleitung des Vorstands ist Fliesstext, mit ihren Umbrüchen. */}
      {intro && (
        <TextSection preserveLines>
          <p>{intro}</p>
        </TextSection>
      )}

      {PULSE_SECTIONS.map((section) => {
        const items = sections[section] ?? [];
        if (items.length === 0) return null;
        return (
          <ListSection key={section} title={t(`pulse.section.${section}`)}>
            {items.map((item) => {
              const href = externalUrl(item);
              return (
                <IonItem
                  key={item.id}
                  // A7: Ein Beitrag von der Website steht dort, nicht in der
                  // App. Der Verweis führt hinaus, und das steht dran.
                  href={href ?? undefined}
                  target={href ? '_blank' : undefined}
                  rel={href ? 'noreferrer' : undefined}
                  detail={Boolean(href)}
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{item.title}</h2>
                    <IonNote>
                      {t(`pulse.kind.${item.kind}`)}
                      {' · '}
                      {item.at ? formatDate(item.at) : t('pulse.noDate')}
                      {href ? ` · ${t('pulse.onWebsite')}` : ''}
                    </IonNote>
                  </IonLabel>
                </IonItem>
              );
            })}
          </ListSection>
        );
      })}

      {/* FR-191: der Gruss am Fuss. Ohne Hinterlegung steht hier nichts –
          kein Platzhalter und keine erfundene Unterschrift (A1). */}
      {signature && (
        <TextSection preserveLines title={t('pulse.greetingTitle')}>
          {signature.text && <p>{signature.text}</p>}
          <p>
            {/* Das Porträt liegt öffentlich (BR-253) und braucht keine
                Signatur. `alt=""`: Der Name steht daneben – ein zweiter
                Vorlesetext wäre Lärm. */}
            {signature.imageUrl && (
              <img className="app-greeting-portrait" src={signature.imageUrl} alt="" />
            )}
            <strong>
              {/* A2: Ein vakantes Amt grüsst als Vorstand. */}
              {signature.vacant ? t('pulse.board') : signature.names.join(', ')}
            </strong>
            {signature.office ? ` · ${signature.office}` : ''}
          </p>
        </TextSection>
      )}
    </>
  );
}

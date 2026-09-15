import { IonButton, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/react';
import { documentTextOutline, openOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import { useOfficeMarkdown } from '../hooks/useOfficeMarkdown';
import { useFactsheetUrl } from '../hooks/useOffices';
import { FormModal } from './FormModal';
import { useSheetProps } from '../hooks/useSheetProps';
import { ListSection } from './ListSection';
import { ManageSection } from './ManageSection';
import { TextSection } from './TextSection';
import { InlineError } from './StateViews';
import { formatDate } from '../lib/format';
import { officePointsExtra, type Office } from '../lib/office';

interface OfficeDetailProps {
  office: Office;
  /** Der Vorstand öffnet von hier das Formular; ohne Vorstandsrolle keine Zeile. */
  onEdit?: (office: Office) => void;
  /** Auflösen – die Seite fragt zuerst nach, das Blatt schliesst vorher. */
  onDissolve?: (office: Office) => void;
  onDismiss: () => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}

/**
 * Ein Amt ansehen (UC-041, FR-126): das digitale Factsheet.
 *
 * Die Reihenfolge folgt dem Papier-Factsheet des Vereins – erst das Warum
 * (falls gepflegt), dann die Pflichten, dann die Eckdaten und die Belegung,
 * zuletzt die Ansprechperson und das PDF. Interessierte sollen wissen, worauf
 * sie sich einlassen, bevor sie jemanden fragen.
 *
 * Das Blatt zeigt nur an: «Schliessen» steht einmal in der Kopfzeile
 * (guidelines §2). Bearbeiten und Auflösen stehen zuletzt im Abschnitt
 * «Verwalten», an derselben Stelle wie in jedem anderen Detail.
 */
export function OfficeDetail({
  office,
  onEdit,
  onDissolve,
  onDismiss,
  isOpen = true,
}: OfficeDetailProps) {
  const { t } = useTranslation();
  const { isAdmin } = useClub();
  const factsheet = useFactsheetUrl(office.factsheetPath);
  const markdown = useOfficeMarkdown();

  const taken = office.holders.filter((holder) => !holder.interim).length;

  return (
    <FormModal isOpen={isOpen} title={office.title} onDismiss={onDismiss}>
      {office.why && (
        <TextSection title={t('offices.why')} preserveLines>
          {office.why}
        </TextSection>
      )}

      {office.duties.length > 0 && (
        <ListSection title={t('offices.duties')}>
          {office.duties.map((duty, index) => (
            <IonItem key={`${duty.title}-${index}`}>
              <IonLabel className="ion-text-wrap">
                <h2>{duty.title}</h2>
                {duty.detail && <IonNote>{duty.detail}</IonNote>}
              </IonLabel>
            </IonItem>
          ))}
        </ListSection>
      )}

      <ListSection title={t('offices.facts')}>
        {/* Der Aufwand ist Freitext («ca. 12 Spiele à 4 Stunden (jedes 3.
            Spiel)») und passt nicht in die Wertspalte: Auf schmalen Geräten
            drückt er das Label auf einen Buchstaben je Zeile. Diese Zeile
            stapelt deshalb – Label oben, Text darunter, beides umbrechend. */}
        {office.hoursPerSeason && (
          <IonItem>
            <IonLabel className="ion-text-wrap">
              <h2>{t('offices.hours')}</h2>
              <IonNote>{office.hoursPerSeason}</IonNote>
            </IonLabel>
          </IonItem>
        )}
        {/* BR-206: Was hier steht, ist die Punktzahl dieser App – nicht mehr
            die alte Vereinsskala aus `points_label`. Von deren Text bleibt
            nur der Zusatz («+ Lohn + Spesen»), weil er etwas sagt, das keine
            Punktzahl ausdrückt. Ohne festgelegten Wert **und** ohne Zusatz
            bleibt die Zeile weg: ein Amt, über das der Vorstand noch nicht
            entschieden hat, soll nicht mit einer Lücke werben. */}
        {(office.seasonPoints !== null || officePointsExtra(office.pointsLabel)) && (
          <IonItem>
            <IonLabel>{t('offices.points')}</IonLabel>
            <IonNote slot="end">
              {[
                office.seasonPoints !== null
                  ? t('offices.pointsValue', { count: office.seasonPoints })
                  : null,
                officePointsExtra(office.pointsLabel),
              ]
                .filter((part): part is string => Boolean(part))
                .join(' · ')}
            </IonNote>
          </IonItem>
        )}
        <IonItem>
          <IonLabel>{t('offices.seats')}</IonLabel>
          <IonNote slot="end">
            {t('offices.filled', { taken, total: office.maxHolders })}
          </IonNote>
        </IonItem>
        {office.contactName && (
          <IonItem>
            <IonLabel>{t('offices.contact')}</IonLabel>
            <IonNote slot="end">{office.contactName}</IonNote>
          </IonItem>
        )}
      </ListSection>

      {/* BR-184: Namen, mit oder ohne Konto. «ad interim» steht dabei, weil
          der Sitz trotzdem als frei zählt. */}
      <ListSection title={t('offices.holders')}>
        {office.holders.length === 0 ? (
          <IonItem>
            <IonLabel className="ion-text-wrap">
              <IonNote>{t('offices.holdersEmpty')}</IonNote>
            </IonLabel>
          </IonItem>
        ) : (
          office.holders.map((holder) => (
            <IonItem key={holder.id}>
              <IonLabel className="ion-text-wrap">
                <h2>{holder.displayName}</h2>
                {holder.since && (
                  <IonNote>{t('offices.holderSince', { date: formatDate(holder.since) })}</IonNote>
                )}
              </IonLabel>
              {holder.interim && (
                <IonNote slot="end">{t('offices.interim')}</IonNote>
              )}
            </IonItem>
          ))
        )}
      </ListSection>

      {/* BR-186: Das PDF kommt über eine signierte Adresse aus dem
          Vereinsspeicher. Als `href` wie der Website-Link der News, damit es
          auf jeder Plattform gleich aufgeht. */}
      {office.factsheetPath && (
        <div className="app-actions">
          {factsheet.error ? (
            <InlineError message={(factsheet.error as Error).message} />
          ) : (
            <IonButton
              expand="block"
              fill="outline"
              disabled={!factsheet.data}
              href={factsheet.data}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IonIcon slot="start" icon={documentTextOutline} aria-hidden="true" />
              {t('offices.factsheetOpen')}
              <IonIcon slot="end" icon={openOutline} aria-hidden="true" />
            </IonButton>
          )}
        </div>
      )}

      {isAdmin && (
        <ManageSection
          actions={[
            onEdit && { label: t('offices.edit'), onClick: () => onEdit(office), detail: true },
            // UC-041 A7: dasselbe Blatt als Datei für die Vereinsablage.
            {
              label: t('offices.markdown.export'),
              onClick: () => void markdown.exportOffices([office]),
            },
            onDissolve && {
              label: t('offices.remove'),
              onClick: () => onDissolve(office),
              destructive: true,
            },
          ]}
        />
      )}
    </FormModal>
  );
}

/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function OfficeDetailModal({
  office,
  ...props
}: Omit<OfficeDetailProps, 'office'> & { office: Office | null }) {
  const sheet = useSheetProps(office ? { office, ...props } : null);
  return sheet && <OfficeDetail {...sheet} />;
}

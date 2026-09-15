import type { ReactNode } from 'react';
import { IonContent, IonNote, IonPage, IonText } from '@ionic/react';

interface AuthShellProps {
  /** Die Überschrift der Seite – das Erste, was gelesen wird. */
  title: string;
  /** Ein Satz darunter, der sagt, worum es geht. */
  subtitle?: string;
  /**
   * Breiteres Feld für Seiten mit Listen und Schrittführung. Die Anmeldung
   * bleibt schmal: Ein Formular mit zwei Feldern liest sich in einer schmalen
   * Spalte besser als über die halbe Bildschirmbreite.
   */
  wide?: boolean;
  /** Was ganz unten steht – Sprachwahl, Abmelden, Hinweise. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Das Gerüst der Seiten **vor** dem Verein: Anmeldung (UC-005) und Onboarding
 * (UC-001, UC-002, UC-004).
 *
 * Beide haben keine Kopfzeile und kein Menü – es gibt noch nichts, wohin ein
 * Zurück führte. Sie sahen trotzdem verschieden aus: Die Anmeldung stand als
 * zentrierte Spalte da, das Onboarding als `AppPage` mit Kopfzeile, und dort
 * lag nur das Segment in der zentrierten Spalte, während Formular und
 * Knopfleiste die ganze Breite nahmen. Auf einem Telefon fiel das nicht auf,
 * auf einem Tabletbildschirm zog sich ein Eingabefeld über 1000 px.
 *
 * Deshalb **ein** Gerüst für beide: dieselbe Spalte, dieselbe Breite, derselbe
 * Abstand von oben. Was darin steht, bestimmt die Seite.
 *
 * Der obere Abstand rechnet die Safe Area mit: Ohne Kopfzeile trägt sie
 * niemand, und auf Geräten mit Dynamic Island lägen die ersten Zeilen sonst
 * unter der Uhr.
 */
export function AuthShell({ title, subtitle, wide = false, footer, children }: AuthShellProps) {
  return (
    <IonPage>
      <IonContent>
        <div className={wide ? 'app-auth app-auth--wide' : 'app-auth'}>
          <header className="app-auth__head">
            <IonText>
              {/* Ionic vergibt hier keine Rolle; die Überschrift ist die der
                  Seite und trägt sie deshalb von Hand. */}
              <h1>{title}</h1>
            </IonText>
            {subtitle && <IonNote>{subtitle}</IonNote>}
          </header>

          {children}

          {footer && <footer className="app-auth__foot">{footer}</footer>}
        </div>
      </IonContent>
    </IonPage>
  );
}

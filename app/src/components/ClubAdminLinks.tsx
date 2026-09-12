import { IonBadge, IonItem, IonLabel, IonNote } from "@ionic/react";
import { useTranslation } from "react-i18next";
import { useClub } from "../hooks/useClub";
import { isModuleOn } from "../lib/clubSettings";
import type { ClubSettings } from "../lib/database.types";
import { usePendingJoinRequests } from "../hooks/useJoinRequests";

/**
 * Die Verwaltungswege des Vorstands als Listeneinträge.
 *
 * Sie stehen an zwei Stellen – im Seitenmenü (`AppMenu`) und auf der
 * Profilseite – und dürfen dort nicht auseinanderlaufen. Eine neue
 * Verwaltungsansicht wird genau hier eingehängt, nicht ein zweites Mal.
 *
 * Ohne Vorstandsrolle rendert die Komponente nichts. Das ist Bequemlichkeit,
 * kein Schutz: Die Berechtigung liegt in den RLS-Policies und in
 * `is_club_admin()` (§9).
 */
/**
 * Hat diese Person überhaupt einen Verwaltungsweg?
 *
 * Die Frage steht hier und nicht bei den beiden Einhängepunkten: Seit UC-034
 * hängt der einzige Weg, den Trainer:innen haben – die Vereins-Gesundheit – an
 * einem Modul. Ohne dieses Modul bliebe sonst eine Überschrift «Verwaltung»
 * über einer leeren Liste stehen.
 *
 * Das ist Bequemlichkeit, kein Schutz: Die Berechtigung liegt in den
 * RLS-Policies und in `is_club_admin()` (guidelines §9).
 */
export function hasAdminLinks(
  isAdmin: boolean,
  isTrainer: boolean,
  settings: ClubSettings | null | undefined,
): boolean {
  if (isAdmin) return true;
  // Die Vereins-Gesundheit gehört auch Trainer:innen – für ihr Team (BR-096).
  return isTrainer && isModuleOn(settings, "health");
}

export function ClubAdminLinks() {
  const { t } = useTranslation();
  const { activeClub, isAdmin, isTrainer } = useClub();
  const pendingRequests = usePendingJoinRequests();

  if (!hasAdminLinks(isAdmin, isTrainer, activeClub?.settings)) return null;

  const pending = pendingRequests.data?.length ?? 0;

  return (
    <>
      {/* UC-034: Das Cockpit ist ein Modul – ohne es bleibt der Weg zu. */}
      {isModuleOn(activeClub?.settings, "health") && (
        <IonItem button routerLink="/tabs/profile/health" detail>
          <IonLabel>{t("health.title")}</IonLabel>
        </IonItem>
      )}

      {!isAdmin ? null : (
        <>
          {isModuleOn(activeClub?.settings, "pulse") && (
            <IonItem button routerLink="/tabs/profile/pulse" detail>
              <IonLabel>{t("pulse.title")}</IonLabel>
            </IonItem>
          )}

          <IonItem button routerLink="/tabs/profile/club" detail>
            <IonLabel>
              <h2>{t("clubSettings.open")}</h2>
              <IonNote>{activeClub?.name}</IonNote>
            </IonLabel>
          </IonItem>

          <IonItem button routerLink="/tabs/profile/members" detail>
            <IonLabel>{t("members.title")}</IonLabel>
          </IonItem>

          {/* Teams sind eine eigene Seite (UC-007 A1, UC-039 Schritt 1) –
              wie in der bestehenden myclub-App. */}
          <IonItem button routerLink="/tabs/profile/teams" detail>
            <IonLabel>{t("teams.title")}</IonLabel>
          </IonItem>

          {/* Die Ämter gehören zum Modul «Sitzungen»: Sie sind der Verteiler,
              über den ein Gremium definiert wird (BR-133). */}
          {isModuleOn(activeClub?.settings, "meeting") && (
            <IonItem button routerLink="/tabs/profile/offices" detail>
              <IonLabel>{t("offices.title")}</IonLabel>
            </IonItem>
          )}

          <IonItem button routerLink="/tabs/profile/rules" detail>
            <IonLabel>{t("pointRules.title")}</IonLabel>
          </IonItem>

          <IonItem button routerLink="/tabs/profile/news" detail>
            <IonLabel>{t("newsImport.title")}</IonLabel>
          </IonItem>

          {/* UC-035: Der Verband ist ein Anschluss wie die Website – und
              steht deshalb daneben. */}
          <IonItem button routerLink="/tabs/profile/federation" detail>
            <IonLabel>{t("federation.title")}</IonLabel>
          </IonItem>

          {/* UC-040: Die bisherige myclub-App ist ein Anschluss auf Zeit –
              bis der Verein ganz hier ist. */}
          <IonItem button routerLink="/tabs/profile/legacy" detail>
            <IonLabel>{t("legacy.title")}</IonLabel>
          </IonItem>

          <IonItem button routerLink="/tabs/profile/invite" detail>
            <IonLabel>{t("invite.title")}</IonLabel>
          </IonItem>

          <IonItem button routerLink="/tabs/profile/requests" detail>
            <IonLabel>{t("joinRequest.title")}</IonLabel>
            {pending > 0 && (
              <IonBadge slot="end" color="danger">
                {pending}
              </IonBadge>
            )}
          </IonItem>
        </>
      )}
    </>
  );
}

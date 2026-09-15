import type { ReactNode } from "react";
import { IonBadge, IonItem, IonLabel, IonNote } from "@ionic/react";
import { useTranslation } from "react-i18next";
import { useClub } from "../hooks/useClub";
import { isModuleOn } from "../lib/clubSettings";
import { usePendingJoinRequests } from "../hooks/useJoinRequests";
import { ListSection } from "./ListSection";

/**
 * Die Verwaltungswege des Vorstands als gegliederte Liste.
 *
 * Sie stehen an zwei Stellen – im Seitenmenü (`AppMenu`) und auf der
 * Profilseite – und dürfen dort nicht auseinanderlaufen. Eine neue
 * Verwaltungsansicht wird genau hier eingehängt, nicht ein zweites Mal.
 *
 * **Die Überschriften gehören der Komponente, nicht den Einhängepunkten**
 * (FR-178): Vierzehn Wege in einer einzigen Gruppe sind keine Gliederung,
 * sondern die Reihenfolge, in der sie gebaut wurden. Gruppiert steht jeder
 * Weg unter der Frage, die ihn sucht – «Menschen», «Punkte & Geld»,
 * «Anschlüsse». Läge die Überschrift wie früher aussen, hätte jeder
 * Einhängepunkt eine eigene Gliederung, und die beiden liefen auseinander.
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
export function hasAdminLinks(isAdmin: boolean, isTrainer: boolean): boolean {
  if (isAdmin) return true;
  // Trainer:innen haben seit UC-043 immer mindestens die Teamliste: Dort
  // führen sie ihr Team und geben ihr Kader heraus (A1). Die Vereins-
  // Gesundheit kommt dazu, wenn das Modul läuft (BR-096).
  return isTrainer;
}

/** Eine Gruppe der Verwaltung: die Überschrift und die Wege, die sie führt. */
interface AdminGroup {
  key: string;
  title: string;
  /** Wege, die an einem Modul hängen, stehen hier als `false`. */
  rows: (ReactNode | false)[];
}

interface ClubAdminLinksProps {
  /** Fussnote unter der ersten Gruppe – etwa der Hinweis der Seitenleiste. */
  hint?: string;
}

export function ClubAdminLinks({ hint }: ClubAdminLinksProps) {
  const { t } = useTranslation();
  const { activeClub, isAdmin, isTrainer } = useClub();
  const pendingRequests = usePendingJoinRequests();

  if (!hasAdminLinks(isAdmin, isTrainer)) return null;

  const settings = activeClub?.settings;
  const pending = pendingRequests.data?.length ?? 0;

  // UC-034: Das Cockpit ist ein Modul – ohne es bleibt der Weg zu.
  const health = isModuleOn(settings, "health") && (
    <IonItem key="health" button routerLink="/tabs/profile/health" detail>
      <IonLabel>{t("health.title")}</IonLabel>
    </IonItem>
  );

  /* Teams sind eine eigene Seite (UC-007 A1, UC-039 Schritt 1) – wie in der
     bestehenden myclub-App. **Auch für Trainer:innen:** Sie führen ihre Teams,
     planen für sie (C-032) und geben ihr Kader heraus (UC-043 A1). Bliebe der
     Weg beim Vorstand, wäre der Team-Export gebaut und unerreichbar. Was sie
     dort tun dürfen, entscheiden die Policies und `can_plan_for_team()`, nicht
     dieser Link. Der Weg steht deshalb einmal hier und wird in beide
     Gliederungen gehängt, nicht abgeschrieben. */
  const teams = (
    <IonItem key="teams" button routerLink="/tabs/profile/teams" detail>
      <IonLabel>{t("teams.title")}</IonLabel>
    </IonItem>
  );

  /* Ohne Vorstandsrolle bleiben höchstens diese zwei Wege übrig. Sie werden
     nicht gegliedert: Zwei Überschriften über je einer Zeile gliedern nichts,
     sie zerreissen nur. */
  const groups: AdminGroup[] = !isAdmin
    ? [{ key: "administration", title: t("menu.administration"), rows: [health, teams] }]
    : [
        /* Was man anschaut, nicht bearbeitet. Beide Wege hängen an einem
           Modul – ist keines an, entfällt die Gruppe samt Überschrift. */
        {
          key: "overview",
          title: t("menu.overview"),
          rows: [
            health,
            isModuleOn(settings, "pulse") && (
              <IonItem key="pulse" button routerLink="/tabs/profile/pulse" detail>
                <IonLabel>{t("pulse.title")}</IonLabel>
              </IonItem>
            ),
          ],
        },

        /* Wer im Verein ist, wie er zusammensteht und wer dazukommt. */
        {
          key: "people",
          title: t("menu.people"),
          rows: [
            <IonItem key="members" button routerLink="/tabs/profile/members" detail>
              <IonLabel>{t("members.title")}</IonLabel>
            </IonItem>,
            teams,
            /* Die Ämter gehören zum Modul «Sitzungen»: Sie sind der Verteiler,
               über den ein Gremium definiert wird (BR-133). */
            isModuleOn(settings, "meeting") && (
              <IonItem key="offices" button routerLink="/tabs/profile/offices" detail>
                <IonLabel>{t("offices.title")}</IonLabel>
              </IonItem>
            ),
            <IonItem key="invite" button routerLink="/tabs/profile/invite" detail>
              <IonLabel>{t("invite.title")}</IonLabel>
            </IonItem>,
            <IonItem key="requests" button routerLink="/tabs/profile/requests" detail>
              <IonLabel>{t("joinRequest.title")}</IonLabel>
              {pending > 0 && (
                <IonBadge slot="end" color="danger">
                  {pending}
                </IonBadge>
              )}
            </IonItem>,
          ],
        },

        /* Was der Verein zählt und was er einzieht. Die Punkteregeln stehen
           immer – die Gruppe kann deshalb nicht leer werden. */
        {
          key: "pointsAndMoney",
          title: t("menu.pointsAndMoney"),
          rows: [
            <IonItem key="rules" button routerLink="/tabs/profile/rules" detail>
              <IonLabel>{t("pointRules.title")}</IonLabel>
            </IonItem>,
            /* UC-042: Das Saisonziel ist ein Modul (BR-199) – ohne es bleibt
               der Weg zu, und der MVP-Schnitt gilt unverändert. */
            isModuleOn(settings, "goal") && (
              <IonItem
                key="contribution"
                button
                routerLink="/tabs/profile/contribution"
                detail
              >
                <IonLabel>{t("seasonGoal.title")}</IonLabel>
              </IonItem>
            ),
            /* UC-046: Rechnungen stellen ist ein Modul wie die anderen – ohne
               es bleibt der Weg zu, und «Meine Rechnungen» auf der Profilseite
               hängt am selben Schalter. */
            isModuleOn(settings, "invoice") && (
              <IonItem key="billing" button routerLink="/tabs/profile/billing" detail>
                <IonLabel>{t("billing.title")}</IonLabel>
              </IonItem>
            ),
          ],
        },

        /* Der Verein als Objekt: Name, Saison, Module, Farben, Labels.
           **Der Eintrag trägt den Titel der Seite**, nicht ein Verb: «Verein
           verwalten» las sich wie die Gruppe über allem anderen – und öffnete
           doch nur ein Blatt neben den übrigen. */
        {
          key: "club",
          title: t("menu.club"),
          rows: [
            <IonItem key="club" button routerLink="/tabs/profile/club" detail>
              <IonLabel>
                <h2>{t("clubSettings.title")}</h2>
                <IonNote>{activeClub?.name}</IonNote>
              </IonLabel>
            </IonItem>,
          ],
        },

        /* Was von aussen hereinkommt. Der Verband ist ein Anschluss wie die
           Website (UC-035), die bisherige myclub-App einer auf Zeit (UC-040) –
           bis der Verein ganz hier ist. */
        {
          key: "connections",
          title: t("menu.connections"),
          rows: [
            <IonItem key="news" button routerLink="/tabs/profile/news" detail>
              <IonLabel>{t("newsImport.title")}</IonLabel>
            </IonItem>,
            <IonItem key="federation" button routerLink="/tabs/profile/federation" detail>
              <IonLabel>{t("federation.title")}</IonLabel>
            </IonItem>,
            <IonItem key="legacy" button routerLink="/tabs/profile/legacy" detail>
              <IonLabel>{t("legacy.title")}</IonLabel>
            </IonItem>,
          ],
        },
      ];

  /* Eine Gruppe, deren Wege alle an ausgeschalteten Modulen hängen, entfällt
     ganz – sonst bliebe ihre Überschrift über einer leeren Liste stehen. Die
     Fussnote geht an die erste Gruppe, die übrig bleibt, und nicht an eine
     feste: Sie erklärt den ganzen Bereich und wäre sonst irgendwann weg. */
  const visible = groups
    .map((group) => ({ ...group, rows: group.rows.filter(Boolean) }))
    .filter((group) => group.rows.length > 0);

  return (
    <>
      {visible.map((group, index) => (
        <ListSection
          key={group.key}
          title={group.title}
          footnote={index === 0 ? hint : undefined}
        >
          {group.rows}
        </ListSection>
      ))}
    </>
  );
}

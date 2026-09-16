import { useEffect, useId, useRef, useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { checkmark } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useMembers } from '../hooks/useMembers';
import { useTeams } from '../hooks/useInvites';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { ListSection } from './ListSection';
import { MemberAvatar } from './MemberAvatar';
import { SkeletonList } from './Skeletons';
import { EmptyState, ErrorState } from './StateViews';
import {
  EMPTY_MEMBER_PICK_FILTER,
  pickableMembers,
  type FilterableMember,
  type MemberPickFilter,
} from '../lib/member';

/**
 * Was der Wähler von einem Mitglied braucht. `ClubMemberWithTeams` aus
 * `useMembers()` erfüllt das; mehr verlangt der Wähler nicht, damit er auch
 * mit einer zusammengestellten Liste arbeitet.
 */
export interface PickableMember extends FilterableMember {
  avatar_url: string | null;
  teamNames: string[];
}

interface PickableTeam {
  id: string;
  name: string;
}

interface MemberPickerFieldsProps {
  members: readonly PickableMember[];
  /** Die Teams des Vereins; mit weniger als zwei entfällt die Zeile. */
  teams: readonly PickableTeam[];
  filter: MemberPickFilter;
  onFilter: (next: MemberPickFilter) => void;
  /** Die gewählten Kennungen – bei Einfachauswahl höchstens eine. */
  selected: readonly string[];
  multiple: boolean;
  /** Zeile «niemand» zuoberst – nur, wo die Auswahl leer bleiben darf. */
  noneLabel?: string;
  /** Eine Zeile wurde angetippt; `null` ist die Zeile «niemand». */
  onToggle: (memberId: string | null) => void;
}

/**
 * Der Inhalt des Wähler-Blatts: Team-Chips und die Namensliste.
 *
 * Eigene Komponente, weil `IonModal` seinen Inhalt im Test nicht rendert
 * (docs/TESTING.md) – und weil die Suche in der Kopfzeile des Blattes sitzt,
 * bleibt hier der Teil, der von ihr abhängt.
 *
 * Die Teams stehen in **einer** Zeile mit Mehrfachauswahl, nicht als Chips:
 * Ein Verein mit einem Dutzend Teams füllte mit Chips den ganzen Bildschirm,
 * bevor der erste Name kommt. Nichts gewählt heisst alle.
 */
export function MemberPickerFields({
  members,
  teams,
  filter,
  onFilter,
  selected,
  multiple,
  noneLabel,
  onToggle,
}: MemberPickerFieldsProps) {
  const { t } = useTranslation();
  const visible = pickableMembers(members, filter);
  const isFiltered = filter.search.trim().length > 0 || filter.teamIds.length > 0;

  return (
    <>
      {/* Der Team-Filter ist der zweite Griff neben der Suche: Wer den Namen
          nicht tippen will, grenzt auf seine Teams ein und liest die kurze
          Liste. Bei einem einzigen Team gäbe es nichts einzugrenzen. Ein
          `IonSelect` über Teams ist in Ordnung – das Verbot in guidelines
          §11 gilt der Liste der Mitglieder, nicht dieser kurzen. */}
      {teams.length > 1 && (
        <ListSection>
          <IonItem>
            <IonSelect
              multiple
              label={t('leaderboard.team')}
              placeholder={t('members.filterAll')}
              value={[...filter.teamIds]}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
              onIonChange={(e) => {
                // Ein Filter ist kein Entwurf: Das umgebende Formular soll
                // davon nichts merken (siehe die Suche im Blatt).
                e.stopPropagation();
                onFilter({ ...filter, teamIds: (e.detail.value as string[] | null) ?? [] });
              }}
            >
              {teams.map((team) => (
                <IonSelectOption key={team.id} value={team.id}>
                  {team.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </ListSection>
      )}

      {visible.length === 0 && !noneLabel ? (
        <EmptyState
          message={t('members.empty')}
          action={
            isFiltered
              ? {
                  label: t('members.resetFilter'),
                  onClick: () => onFilter(EMPTY_MEMBER_PICK_FILTER),
                }
              : undefined
          }
        />
      ) : (
        <ListSection title={t('members.count', { count: visible.length })}>
          {/* BR-184 und ihresgleichen: Wo «niemand» eine gültige Antwort ist,
              steht sie zuoberst und nicht am Ende einer langen Liste. */}
          {noneLabel && (
            <IonItem
              button
              detail={false}
              aria-current={selected.length === 0 ? 'true' : undefined}
              onClick={() => onToggle(null)}
            >
              {/* Der Text steht in einem `h2` wie jeder Name darunter – als
                  blosser Inhalt der `IonLabel` fände ihn kein Test
                  (docs/TESTING.md §1 Nr. 3). */}
              <IonLabel className="ion-text-wrap">
                <h2>{noneLabel}</h2>
              </IonLabel>
              {selected.length === 0 && (
                <IonIcon slot="end" icon={checkmark} color="primary" aria-hidden="true" />
              )}
            </IonItem>
          )}

          {visible.map((member) => {
            const isChosen = selected.includes(member.id);
            const teamNames = member.teamNames.join(', ');

            // Mehrfachauswahl trägt Kästchen wie jede Mehrfachauswahl der App
            // (`FederationImportModal`), Einfachauswahl den Haken – das Muster
            // des Auswahl-Blattes, das ein `IonSelect` zeigt.
            return multiple ? (
              <IonItem key={member.id}>
                <MemberAvatar
                  displayName={member.display_name}
                  avatarUrl={member.avatar_url}
                />
                <IonCheckbox
                  labelPlacement="end"
                  justify="start"
                  checked={isChosen}
                  onIonChange={() => onToggle(member.id)}
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{member.display_name}</h2>
                    {teamNames && <IonNote>{teamNames}</IonNote>}
                  </IonLabel>
                </IonCheckbox>
                <StatusBadge status={member.status} />
              </IonItem>
            ) : (
              <IonItem
                key={member.id}
                button
                detail={false}
                aria-current={isChosen ? 'true' : undefined}
                onClick={() => onToggle(member.id)}
              >
                <MemberAvatar
                  displayName={member.display_name}
                  avatarUrl={member.avatar_url}
                />
                <IonLabel className="ion-text-wrap">
                  <h2>{member.display_name}</h2>
                  {teamNames && <IonNote>{teamNames}</IonNote>}
                </IonLabel>
                <StatusBadge status={member.status} />
                {isChosen && (
                  <IonIcon slot="end" icon={checkmark} color="primary" aria-hidden="true" />
                )}
              </IonItem>
            );
          })}
        </ListSection>
      )}
    </>
  );
}

/**
 * Der Status am Zeilenende – aber nur, wenn er vom Gewöhnlichen abweicht.
 *
 * Wer ausgetreten ist, steht weiter in der Liste: Eine Korrekturbuchung oder
 * ein aufzulösendes Amt betrifft genau diese Person. Dass sie nicht mehr dabei
 * ist, muss die Zeile aber sagen.
 */
function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status === 'active') return null;
  return (
    <IonBadge slot="end" color="medium">
      {t(`members.statusValue.${status}`, { defaultValue: status })}
    </IonBadge>
  );
}

interface MemberPickerModalProps {
  isOpen: boolean;
  title: string;
  /** Mehrere Personen auf einmal – dann entscheidet «Übernehmen». */
  multiple?: boolean;
  /** Die geltende Auswahl; der Entwurf im Blatt beginnt damit. */
  selected: readonly string[];
  /** Beschriftung für «niemand»; ohne sie fehlt die Zeile. */
  noneLabel?: string;
  onSelect: (memberIds: string[]) => void;
  onDismiss: () => void;
}

/**
 * Mitglieder suchen und auswählen – das Blatt hinter jedem `MemberSelect`.
 *
 * **Warum kein `IonSelect`:** Dessen Auswahl-Blatt kennt weder Suche noch
 * Filter. Bei einem Verein mit über hundert Mitgliedern ist die Liste darin
 * eine Scrollstrecke, auf der man den gesuchten Namen nur findet, wenn man
 * seine Stelle im Alphabet errät – und zwei gleiche Vornamen sind gar nicht
 * auseinanderzuhalten. Dieses Blatt hat beides: die Suche in der Kopfzeile,
 * darunter die Teams als Mehrfachauswahl, und in jeder Zeile Avatar, Team
 * und Status.
 *
 * Einfachauswahl wirkt sofort und schliesst – wie ein `IonSelect`. Die
 * Mehrfachauswahl arbeitet auf einem Entwurf und gibt ihn erst mit
 * «Übernehmen» heraus; wer abbricht, behält, was vorher galt. Kein
 * `FormModal`: Hier wird nichts gespeichert, und der Entwurfswächter fragte
 * beim Schliessen nach der getippten Suche.
 */
export function MemberPickerModal({
  isOpen,
  title,
  multiple = false,
  selected,
  noneLabel,
  onSelect,
  onDismiss,
}: MemberPickerModalProps) {
  const { t } = useTranslation();
  const presentingElement = usePresentingElement();
  const modal = useRef<HTMLIonModalElement>(null);
  const titleId = useId();

  const members = useMembers();
  const teams = useTeams();

  const [filter, setFilter] = useState<MemberPickFilter>(EMPTY_MEMBER_PICK_FILTER);
  const [draft, setDraft] = useState<string[]>([...selected]);

  useEffect(() => {
    // Nur der Übergang zu «offen» zählt: Jedes Öffnen beginnt mit der
    // geltenden Auswahl und einer leeren Suche, damit die Liste nicht dort
    // steht, wo sie beim letzten Mal endete.
    if (isOpen) {
      setFilter(EMPTY_MEMBER_PICK_FILTER);
      setDraft([...selected]);
    }
  }, [isOpen]);

  function dismiss() {
    // Über Ionic und nicht direkt an `onDismiss`: Nur so fährt das Blatt zu,
    // statt aus dem Baum zu fallen (guidelines §2).
    if (modal.current?.dismiss) void modal.current.dismiss();
    else onDismiss();
  }

  function toggle(memberId: string | null) {
    if (!multiple) {
      onSelect(memberId ? [memberId] : []);
      dismiss();
      return;
    }
    if (memberId === null) {
      setDraft([]);
      return;
    }
    setDraft((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  }

  function apply() {
    onSelect(draft);
    dismiss();
  }

  return (
    <IonModal
      ref={modal}
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      presentingElement={presentingElement}
      aria-labelledby={titleId}
    >
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={dismiss}>
              {multiple ? t('common.cancel') : t('common.close')}
            </IonButton>
          </IonButtons>
          <IonTitle id={titleId} role="heading" aria-level={2}>
            {title}
          </IonTitle>
        </IonToolbar>
        {/* Die Suche steht in der Kopfzeile und nicht im Inhalt: Sie soll
            stehen bleiben, während die Liste darunter läuft. */}
        <IonToolbar>
          <IonSearchbar
            value={filter.search}
            placeholder={t('members.search')}
            inputmode="search"
            enterkeyhint="search"
            onIonInput={(e) => {
              // Der Wähler steht meist in einem Formular, und dessen
              // Entwurfswächter hört auf jedes `ionInput`, das bis zu ihm
              // aufsteigt (`FormModal`). Ein Suchwort ist aber kein Entwurf:
              // Ohne diese Bremse fragte das Formular nach dem Abbrechen
              // «Änderungen verwerfen?», obwohl niemand etwas geändert hat.
              e.stopPropagation();
              setFilter((current) => ({ ...current, search: e.detail.value ?? '' }));
            }}
          />
        </IonToolbar>
      </IonHeader>

      <IonContent color="light">
        {members.isLoading ? (
          <SkeletonList rows={6} />
        ) : members.error ? (
          <ErrorState
            error={members.error as Error}
            onRetry={() => void members.refetch()}
          />
        ) : (
          <MemberPickerFields
            members={members.data ?? []}
            teams={teams.data ?? []}
            filter={filter}
            onFilter={setFilter}
            selected={multiple ? draft : selected}
            multiple={multiple}
            noneLabel={noneLabel}
            onToggle={toggle}
          />
        )}
      </IonContent>

      {multiple && (
        <IonFooter>
          <IonToolbar>
            <IonButton expand="block" className="ion-margin-horizontal" onClick={apply}>
              {draft.length > 0
                ? t('memberPicker.applyCount', { count: draft.length })
                : t('memberPicker.apply')}
            </IonButton>
          </IonToolbar>
        </IonFooter>
      )}
    </IonModal>
  );
}

type MemberSelectProps = {
  /** Beschriftung der Zeile, wie am `IonSelect`, das sie ersetzt. */
  label: string;
  /** Titel des Blattes; ohne ihn steht die Beschriftung darin. */
  title?: string;
  /** Beschriftung für «niemand»; ohne sie ist die Auswahl verbindlich. */
  noneLabel?: string;
  /**
   * Name, solange die Mitgliederliste noch lädt – etwa der schon gespeicherte
   * Name der gewählten Person. Ohne ihn stünde dort kurz «Wählen».
   */
  fallbackName?: string;
} & (
  | {
      multiple?: false;
      value: string | null;
      /** Das Mitglied kommt mit: Wer den Namen braucht, sucht ihn nicht erneut. */
      onChange: (memberId: string | null, member: PickableMember | null) => void;
    }
  | {
      multiple: true;
      value: readonly string[];
      onChange: (memberIds: string[]) => void;
    }
);

/**
 * Die Zeile, die zur Mitgliederwahl führt – der Ersatz für ein `IonSelect`
 * über Mitglieder, in der ganzen App.
 *
 * Aussen dieselbe Zeile wie überall («Beschriftung links, Wahl rechts, Pfeil»,
 * wie in der Rangliste), innen das Blatt mit Suche und Team-Filter. Ein
 * Aufrufer braucht dafür nichts zu laden: Die Mitglieder kommen aus
 * `useMembers()`, die Teams aus `useTeams()` – beide aus demselben
 * Query-Cache, den die Seiten ohnehin füllen.
 */
export function MemberSelect(props: MemberSelectProps) {
  const { t } = useTranslation();
  const { label, title, noneLabel, fallbackName } = props;
  const [isOpen, setOpen] = useState(false);

  const members = useMembers();
  const list = members.data ?? [];
  const selected = props.multiple
    ? [...props.value]
    : props.value
      ? [props.value]
      : [];

  // Nach der Liste sortiert und nicht nach der Reihenfolge des Antippens: Die
  // Zeile soll beim zweiten Blick dasselbe zeigen wie beim ersten.
  const names = list
    .filter((member) => selected.includes(member.id))
    .map((member) => member.display_name)
    .sort((a, b) => a.localeCompare(b, 'de'));

  const valueText = summarize({
    names,
    count: selected.length,
    fallbackName,
    noneLabel,
    t,
  });

  function choose(memberIds: string[]) {
    if (props.multiple) {
      props.onChange(memberIds);
      return;
    }
    const id = memberIds[0] ?? null;
    props.onChange(id, list.find((member) => member.id === id) ?? null);
  }

  return (
    <>
      <IonItem button detail onClick={() => setOpen(true)}>
        <IonLabel>{label}</IonLabel>
        <IonNote slot="end" className="ion-text-wrap ion-text-end">
          {valueText}
        </IonNote>
      </IonItem>

      <MemberPickerModal
        isOpen={isOpen}
        title={title ?? label}
        multiple={props.multiple}
        selected={selected}
        noneLabel={noneLabel}
        onSelect={choose}
        onDismiss={() => setOpen(false)}
      />
    </>
  );
}

/**
 * Was in der Zeile steht: bis zu zwei Namen, sonst ihre Zahl.
 *
 * Zwei Namen sind kürzer als «2 gewählt» und sagen mehr; bei dreien wird die
 * Zeile zur Aufzählung, die rechts nicht mehr lesbar umbricht.
 */
function summarize({
  names,
  count,
  fallbackName,
  noneLabel,
  t,
}: {
  names: readonly string[];
  count: number;
  fallbackName?: string;
  noneLabel?: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}): string {
  if (count === 0) return noneLabel ?? t('memberPicker.choose');
  // Die Liste lädt noch: Der mitgegebene Name hält die Zeile in der Zwischenzeit.
  if (names.length === 0) return fallbackName ?? t('memberPicker.choose');
  if (names.length <= 2) return names.join(', ');
  return t('memberPicker.selected', { count: names.length });
}

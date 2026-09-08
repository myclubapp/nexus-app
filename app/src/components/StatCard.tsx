import { IonCard, IonCardContent, IonText } from '@ionic/react';

interface StatCardProps {
  value: string | number;
  label: string;
  accent?: 'primary' | 'secondary' | 'tertiary';
}

/** Eine Kennzahl mit Beschriftung. Mehrere davon stehen in `.app-stat-row`. */
export function StatCard({ value, label, accent = 'primary' }: StatCardProps) {
  return (
    <IonCard className="app-stat">
      <IonCardContent>
        <IonText color={accent}>
          <span className="app-stat__value">{value}</span>
        </IonText>
        <span className="app-stat__label">{label}</span>
      </IonCardContent>
    </IonCard>
  );
}

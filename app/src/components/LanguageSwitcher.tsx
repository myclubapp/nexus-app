import { IonSelect, IonSelectOption } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? 'de').split('-')[0];

  return (
    <IonSelect
      label={t('profile.language')}
      labelPlacement="stacked"
      value={current}
      onIonChange={(e) => void i18n.changeLanguage(e.detail.value as string)}
    >
      {SUPPORTED_LANGUAGES.map((code) => (
        <IonSelectOption key={code} value={code}>
          {t(`language.${code}`)}
        </IonSelectOption>
      ))}
    </IonSelect>
  );
}

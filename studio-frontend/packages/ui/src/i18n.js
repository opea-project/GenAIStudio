import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';

const resources = {
  en: { translation: en },
  zh: { translation: zh }
};

const getInitialLanguage = () => {
  if (typeof window === 'undefined') return 'en';

  try {
    const preferredLanguage = window.localStorage.getItem('preferredLanguage') || '';
    return preferredLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  } catch (error) {
    return 'en';
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

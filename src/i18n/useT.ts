import { getLocales } from 'expo-localization';
import { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { AppLocale, resolveLocale, translate, TranslationKey } from './index';

export function useT() {
  const { prefs } = useApp();
  return useMemo(() => {
    let tags: string[] = [];
    try {
      tags = getLocales().map((l) => l.languageTag);
    } catch {
      tags = [];
    }
    const locale: AppLocale = resolveLocale(tags, prefs.language);
    const t = (key: TranslationKey, params?: Record<string, string | number>) => translate(locale, key, params);
    return { t, locale };
  }, [prefs.language]);
}

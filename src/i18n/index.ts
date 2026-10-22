import { en } from './locales/en';
import { es } from './locales/es';
import { ptBR, TranslationKey, Translations } from './locales/pt-BR';
import { zhHans } from './locales/zh-Hans';

export type AppLocale = 'pt-BR' | 'en' | 'es' | 'zh-Hans';
export const SUPPORTED_LOCALES: AppLocale[] = ['pt-BR', 'en', 'es', 'zh-Hans'];

export const DICTIONARIES: Record<AppLocale, Translations> = { 'pt-BR': ptBR, en, es, 'zh-Hans': zhHans };

/**
 * Escolhe o idioma a partir das preferências do sistema (BCP-47, em ordem) e de uma escolha manual.
 * Português de Portugal cai em pt-BR; chinês tradicional (zh-Hant/TW/HK) ainda não é suportado
 * e cai em inglês, para não exibir caracteres simplificados a quem lê tradicional.
 */
export function resolveLocale(systemTags: string[], override: AppLocale | 'system' = 'system'): AppLocale {
  if (override !== 'system') return override;
  for (const raw of systemTags) {
    const tag = raw.toLowerCase();
    if (tag.startsWith('pt')) return 'pt-BR';
    if (tag.startsWith('es')) return 'es';
    if (tag.startsWith('en')) return 'en';
    if (tag.startsWith('zh')) {
      const traditional = tag.includes('hant') || /-(tw|hk|mo)\b/.test(tag);
      if (!traditional) return 'zh-Hans';
      continue;
    }
  }
  return systemTags.length ? 'en' : 'pt-BR';
}

export function translate(locale: AppLocale, key: TranslationKey, params: Record<string, string | number> = {}): string {
  const dict = DICTIONARIES[locale] ?? ptBR;
  const template = dict[key] ?? ptBR[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export type { TranslationKey };

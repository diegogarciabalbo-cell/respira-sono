import { DICTIONARIES, resolveLocale, SUPPORTED_LOCALES, translate } from '../src/i18n';
import { ptBR } from '../src/i18n/locales/pt-BR';

describe('i18n', () => {
  test('todos os idiomas têm exatamente as mesmas chaves da fonte (pt-BR)', () => {
    const keys = Object.keys(ptBR).sort();
    for (const l of SUPPORTED_LOCALES) expect(Object.keys(DICTIONARIES[l]).sort()).toEqual(keys);
  });

  test('nenhuma tradução vazia e mesmos parâmetros {x} da fonte', () => {
    for (const l of SUPPORTED_LOCALES) {
      for (const [k, v] of Object.entries(DICTIONARIES[l])) {
        expect(v.trim().length).toBeGreaterThan(0);
        const params = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
        expect(params(v)).toEqual(params((ptBR as Record<string, string>)[k]));
      }
    }
  });

  test('resolução de idioma do sistema', () => {
    expect(resolveLocale(['pt-PT'])).toBe('pt-BR');
    expect(resolveLocale(['es-MX', 'en-US'])).toBe('es');
    expect(resolveLocale(['zh-Hans-CN'])).toBe('zh-Hans');
    expect(resolveLocale(['zh-Hant-TW'])).toBe('en');
    expect(resolveLocale(['zh-TW', 'es-ES'])).toBe('es');
    expect(resolveLocale(['fr-FR'])).toBe('en');
    expect(resolveLocale([])).toBe('pt-BR');
    expect(resolveLocale(['en-US'], 'zh-Hans')).toBe('zh-Hans');
  });

  test('aviso obrigatório de "não é dispositivo médico" em todos os idiomas', () => {
    expect(translate('en', 'safety.notMedicalDevice')).toContain('not a medical device');
    expect(translate('es', 'safety.notMedicalDevice')).toContain('No es un dispositivo médico');
    expect(translate('zh-Hans', 'safety.notMedicalDevice')).toContain('不是医疗器械');
  });

  test('interpolação', () => {
    expect(translate('pt-BR', 'safety.footer', { emergency: '192' })).toContain('ligue 192');
  });
});

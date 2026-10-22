/* Validação dos textos das lojas: limites, aviso obrigatório e termos proibidos. */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const listings = require('../store/listings.json');

const LOCALES = ['pt-BR', 'en', 'es', 'zh-Hans'] as const;
const len = (s: string) => [...s].length;
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

const DISCLAIMER: Record<string, RegExp> = {
  'pt-BR': /não é um dispositivo médico e não diagnostica, trata, cura nem previne/i,
  en: /not a medical device and does not diagnose, treat, cure or prevent/i,
  es: /no es un dispositivo médico y no diagnostica, trata, cura ni previene/i,
  'zh-Hans': /不是医疗器械，不用于诊断、治疗、治愈或预防/,
};

// Promessas e alegações clínicas não permitidas.
const FORBIDDEN = /cura o ronco|acaba com o ronco|elimina|garant|diagnóstico automático|stops snoring|cure snoring|guarantee|diagnos(e|is) (sleep )?apnea|detects apnea|cura el ronquido|elimina el ronquido|garantiza|根治|治愈打鼾|保证|诊断呼吸暂停|IAH|AHI|polissonografia caseira|clinically proven|clinicamente comprovado/i;
const DISEASE_IN_ASO = /apnei|apnea|apnoea|呼吸暂停/i;

describe.each(LOCALES)('listagem %s', (loc) => {
  const l = listings[loc];

  test('limites das lojas', () => {
    expect(len(l.name)).toBeLessThanOrEqual(30); // App Store name / Play title
    expect(len(l.subtitle)).toBeLessThanOrEqual(30); // App Store subtitle
    expect(bytes(l.keywords)).toBeLessThanOrEqual(100); // App Store keywords (bytes)
    expect(len(l.promotionalText)).toBeLessThanOrEqual(170);
    expect(len(l.playShortDescription)).toBeLessThanOrEqual(80);
    expect(len(l.description)).toBeLessThanOrEqual(4000);
  });

  test('aviso de "não é dispositivo médico" (política de apps de saúde do Google Play)', () => {
    expect(l.description).toMatch(DISCLAIMER[loc]);
  });

  test('sem promessas proibidas', () => {
    expect(JSON.stringify(l)).not.toMatch(FORBIDDEN);
  });

  test('nome de doença fora de título, subtítulo, palavras-chave e textos curtos', () => {
    for (const k of ['name', 'subtitle', 'keywords', 'promotionalText', 'playShortDescription']) {
      expect(l[k]).not.toMatch(DISEASE_IN_ASO);
    }
  });
});

/**
 * Fonte de verdade das chaves de tradução. Outros idiomas devem ter exatamente as mesmas chaves
 * (verificado em tests/i18n.test.ts).
 *
 * Migração em andamento: as chaves abaixo cobrem navegação, avisos de segurança e o seletor de idioma.
 * As demais telas ainda usam textos em português diretamente no código — tarefa do agente
 * `localization-specialist` (ver .claude/agents).
 */
export const ptBR = {
  'meta.reviewStatus': 'source',
  'meta.languageName': 'Português (Brasil)',

  'tabs.today': 'Hoje',
  'tabs.record': 'Gravar noite',
  'tabs.exercises': 'Exercícios',
  'tabs.history': 'Histórico',
  'tabs.profile': 'Perfil',

  'stack.nightSummary': 'Seu resumo da noite',
  'stack.exercise': 'Exercício',
  'stack.diary': 'Diário da noite',
  'stack.report': 'Relatório compartilhável',
  'stack.library': 'Biblioteca',
  'stack.content': 'Gerenciar conteúdo',
  'stack.micTest': 'Teste de microfone',
  'stack.about': 'Sobre e limites',
  'stack.back': 'Voltar',

  'safety.footer': 'O RESPIRA Sono não diagnostica nem monitora emergências. Em caso de dificuldade intensa para respirar, ligue {emergency}.',
  'safety.emergencyNumber': '192',
  'safety.notMedicalDevice': 'Não é um dispositivo médico e não diagnostica, trata, cura nem previne doenças. Consulte um profissional de saúde para orientação, diagnóstico ou tratamento.',

  'language.title': 'Idioma',
  'language.system': 'Do sistema',
  'language.partialNotice': 'Tradução em andamento: parte do app ainda aparece em português.',
} as const;

export type TranslationKey = keyof typeof ptBR;
export type Translations = Record<TranslationKey, string>;

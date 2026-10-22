import { ExerciseContent, ProgramContent } from '../domain/content';

/**
 * EXERCÍCIOS EM RASCUNHO, BASEADOS EM PESQUISA — NÃO REVISADOS.
 *
 * Origem: os seis exercícios do grupo de terapia de Ieto et al. (2015), ensaio randomizado
 * com 39 adultos com ronco primário ou apneia leve a moderada, 3 meses, com acompanhamento
 * especializado. As descrições foram obtidas de FONTES SECUNDÁRIAS (cobertura jornalística
 * médica do artigo, consultada em 21/10/2026); o artigo original (Chest 2015;148(3):683-691,
 * DOI 10.1378/chest.14-2953) precisa ser conferido pelo revisor.
 *
 * Regras:
 * - status "draft", sem revisor, `dose: null`. O app mostra apenas em modo de demonstração,
 *   com aviso de que não é tratamento aprovado.
 * - O protocolo do estudo aparece como informação de referência, nunca como dose para o usuário.
 * - Os resultados do estudo NÃO comprovam a eficácia deste aplicativo.
 * - Instruções em linguagem simples, redigidas pela equipe de produto a partir das descrições
 *   publicadas; precisam ser reescritas/validadas por fonoaudiólogo com atuação em sono.
 */

const IETO = { label: 'Ieto et al., 2015 — ensaio randomizado, Chest', url: 'https://pubmed.ncbi.nlm.nih.gov/25950418/' };
const COCHRANE = {
  label: 'Revisão Cochrane, 2020 — benefícios possíveis, evidência de certeza moderada a muito baixa',
  url: 'https://www.cochrane.org/evidence/CD013449_myofunctional-therapy-oropharyngeal-mouth-and-throat-exercises-people-obstructive-sleep-apnoea',
};
const SECONDARY_SOURCE = 'Descrição do protocolo do grupo de terapia de Ieto et al. (2015) em cobertura médica secundária (MDedge; Healio, 2015).';
const FREQ_DISCREPANCY =
  'Fontes secundárias divergem: uma descreve cerca de 8 minutos de exercícios três vezes ao dia; outra, cerca de 8 minutos por dia. Conferir no artigo original.';

const AUDIENCE_DRAFT =
  'Proposta para revisão: adultos (18+) com ronco, após avaliação médica que descarte apneia grave ou outra condição que exija tratamento diferente.';

const GENERAL_STOP = [
  'Pare se sentir dor, falta de ar, tontura, engasgo ou desconforto importante.',
  'Pare se surgir dor na mandíbula, no ouvido ou na garganta, e procure orientação profissional.',
];

const GENERAL_CAUTIONS = [
  'Faça sentado, com postura confortável e sem pressa.',
  'Não force nem prenda a respiração. Respire normalmente pelo nariz entre as repetições.',
  'Exercícios feitos de forma incorreta podem não ter efeito; o acompanhamento de um profissional é recomendado.',
];

const CONTRA_PENDING = ['[Contraindicações a definir pelo revisor clínico]'];

function draft(e: Omit<ExerciseContent, 'version' | 'status' | 'media' | 'audioInstructionUri' | 'dose' | 'progression' | 'reviewer' | 'isDemo' | 'history' | 'references' | 'stopIf' | 'contraindications'> & {
  extraCautions?: string[];
}): ExerciseContent {
  const { extraCautions, ...rest } = e;
  return {
    ...rest,
    version: 1,
    status: 'draft',
    media: { kind: 'none' },
    audioInstructionUri: null,
    dose: null,
    progression: null,
    cautions: [...GENERAL_CAUTIONS, ...(extraCautions ?? []), ...rest.cautions],
    contraindications: CONTRA_PENDING,
    stopIf: GENERAL_STOP,
    references: [IETO, COCHRANE],
    reviewer: null,
    isDemo: false,
    history: [],
  };
}

export const DRAFT_EXERCISES: ExerciseContent[] = [
  draft({
    id: 'ieto-1-lingua-desliza',
    name: 'Ponta da língua no céu da boca, deslizando para trás',
    topic: 'lingua',
    objective: 'Trabalhar a mobilidade e a força da língua (descrição do estudo).',
    audience: AUDIENCE_DRAFT,
    instructions: [
      'Encoste a ponta da língua no céu da boca, logo atrás dos dentes da frente.',
      'Pressione a ponta da língua contra o céu da boca e deslize a língua para trás, mantendo o contato.',
      'Volte a língua para a posição inicial. Isso é uma repetição.',
    ],
    cautions: [],
    researchProtocol: { description: '20 repetições por série.', source: SECONDARY_SOURCE, sourceType: 'secondary', discrepancies: [FREQ_DISCREPANCY] },
  }),
  draft({
    id: 'ieto-2-lingua-succao',
    name: 'Língua inteira “grudada” no céu da boca',
    topic: 'lingua',
    objective: 'Trabalhar a elevação e o contato da língua com o palato (descrição do estudo).',
    audience: AUDIENCE_DRAFT,
    instructions: [
      'Puxe a língua inteira para cima, como se fosse sugá-la contra o céu da boca.',
      'Mantenha toda a superfície da língua pressionada contra o palato por um instante.',
      'Solte e relaxe a língua. Isso é uma repetição.',
    ],
    cautions: [],
    researchProtocol: { description: '20 repetições por série.', source: SECONDARY_SOURCE, sourceType: 'secondary', discrepancies: [FREQ_DISCREPANCY] },
  }),
  draft({
    id: 'ieto-3-base-lingua',
    name: 'Fundo da língua para baixo, ponta nos dentes de baixo',
    topic: 'lingua',
    objective: 'Trabalhar a base da língua (descrição do estudo).',
    audience: AUDIENCE_DRAFT,
    instructions: [
      'Encoste a ponta da língua atrás dos dentes inferiores da frente.',
      'Mantendo a ponta ali, empurre a parte de trás da língua para baixo, em direção ao assoalho da boca.',
      'Relaxe. Isso é uma repetição.',
    ],
    cautions: [],
    researchProtocol: { description: '20 repetições por série.', source: SECONDARY_SOURCE, sourceType: 'secondary', discrepancies: [FREQ_DISCREPANCY] },
  }),
  draft({
    id: 'ieto-4-palato-a',
    name: 'Elevar o palato mole falando “A”',
    topic: 'palato',
    objective: 'Trabalhar a elevação do palato mole e da úvula (descrição do estudo).',
    audience: AUDIENCE_DRAFT,
    instructions: [
      'Abra a boca de forma confortável.',
      'Diga “A” de forma curta e repetida, sentindo o fundo da boca (palato mole e “campainha”) subir a cada som.',
      'Cada “A” com elevação do palato é uma repetição. Se quiser, use um espelho para observar.',
    ],
    cautions: ['Use voz em volume normal; não grite nem force a garganta.'],
    researchProtocol: { description: '20 repetições, dizendo “A” de forma intermitente.', source: SECONDARY_SOURCE, sourceType: 'secondary', discrepancies: [FREQ_DISCREPANCY] },
  }),
  draft({
    id: 'ieto-5-bochecha',
    name: 'Dedo dentro da bochecha, empurrando para fora',
    topic: 'orofaringe',
    objective: 'Trabalhar o músculo da bochecha (bucinador) (descrição do estudo).',
    audience: AUDIENCE_DRAFT,
    instructions: [
      'Lave bem as mãos.',
      'Coloque o dedo indicador dentro da boca, apoiado na parte interna de uma bochecha.',
      'Com o dedo, pressione a bochecha para fora, enquanto a bochecha faz força no sentido contrário, para dentro.',
      'Relaxe. Isso é uma repetição. Faça as repetições de um lado e depois do outro.',
    ],
    extraCautions: ['Unhas curtas e mãos limpas. Não faça com feridas na boca.'],
    cautions: [],
    researchProtocol: { description: '10 repetições de cada lado.', source: SECONDARY_SOURCE, sourceType: 'secondary', discrepancies: [FREQ_DISCREPANCY, 'Direção exata da força (bochecha contra o dedo) a confirmar no artigo original.'] },
  }),
  draft({
    id: 'ieto-6-mastigacao',
    name: 'Mastigar e engolir dos dois lados nas refeições',
    topic: 'orofaringe',
    objective: 'Incentivar mastigação alternada bilateral e deglutição durante as refeições (descrição do estudo).',
    audience: AUDIENCE_DRAFT,
    instructions: [
      'Nas refeições, alterne a mastigação entre o lado direito e o lado esquerdo da boca.',
      'Ao engolir, evite contrair os lábios e a musculatura ao redor da boca.',
      'Este exercício é feito durante as refeições, não em uma sessão separada.',
    ],
    cautions: ['Mastigue devagar e com atenção. Pessoas com dificuldade para engolir devem ser avaliadas antes.'],
    researchProtocol: { description: 'Sempre que se alimentar, sem número de repetições.', source: SECONDARY_SOURCE, sourceType: 'secondary', discrepancies: [] },
  }),
];

export const DRAFT_PROGRAM: ProgramContent = {
  id: 'programa-ronco-ieto-rascunho',
  version: 1,
  status: 'draft',
  name: 'Programa candidato para ronco (rascunho baseado em Ieto et al., 2015)',
  exerciseIds: DRAFT_EXERCISES.map((e) => e.id),
  schedule: null,
  researchProtocol: {
    description: 'No estudo: exercícios diários por 3 meses, com acompanhamento especializado. ' + FREQ_DISCREPANCY,
    source: SECONDARY_SOURCE,
  },
  reviewer: null,
};

/** Mantido para compatibilidade com telas/testes anteriores. */
export const DEMO_EXERCISES = DRAFT_EXERCISES;

/** Tempo usado apenas para demonstrar o temporizador enquanto não há dose revisada. Não é dose. */
export const DEMO_TIMER_SECONDS = 20;

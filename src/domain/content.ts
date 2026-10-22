/**
 * Conteúdo de exercícios e fluxo editorial: rascunho → revisão → publicação → retirada.
 * Publicar exige revisor real com credencial verificável. Mudança material em conteúdo
 * publicado gera nova versão em rascunho, que precisa de nova revisão.
 */

export type ContentStatus = 'draft' | 'in_review' | 'published' | 'retired';

export interface Reviewer {
  name: string;
  /** ex.: "CRFa 2-00000" ou "CRM-SP 000000 / RQE 0000" */
  credential: string;
  credentialVerifiedAt: string | null;
  approvedAt: string | null;
}

export interface Dose {
  sets?: number;
  reps?: number;
  holdSeconds?: number;
  durationSeconds?: number;
  timesPerDay?: number;
  daysPerWeek?: number;
}

export interface ExerciseContent {
  id: string;
  version: number;
  status: ContentStatus;
  name: string;
  topic: 'lingua' | 'palato' | 'orofaringe' | 'outro';
  objective: string;
  audience: string;
  instructions: string[];
  media: { kind: 'video' | 'animation' | 'none'; uri?: string; license?: string; captionsUri?: string };
  audioInstructionUri?: string | null;
  /** Definida exclusivamente pelo revisor. `null` = ainda não definida. */
  dose: Dose | null;
  progression: string | null;
  cautions: string[];
  contraindications: string[];
  stopIf: string[];
  references: { label: string; url: string }[];
  reviewer: Reviewer | null;
  isDemo: boolean;
  /**
   * Como o exercício foi descrito em pesquisa publicada. É informação de referência para o revisor
   * e para o usuário — NÃO é dose prescrita e nunca preenche `dose` automaticamente.
   */
  researchProtocol?: { description: string; source: string; sourceType: 'primary' | 'secondary'; discrepancies?: string[] } | null;
  history: { at: string; from: ContentStatus | null; to: ContentStatus; by: string; note?: string }[];
}

export interface ProgramContent {
  id: string;
  version: number;
  status: ContentStatus;
  name: string;
  exerciseIds: string[];
  /** Duração e frequência do programa: definidas pelo revisor. */
  schedule: { weeks: number; sessionsPerDay: number; daysPerWeek: number } | null;
  researchProtocol: { description: string; source: string } | null;
  reviewer: Reviewer | null;
}

const ALLOWED: Record<ContentStatus, ContentStatus[]> = {
  draft: ['in_review'],
  in_review: ['draft', 'published'],
  published: ['retired'],
  retired: [],
};

export function reviewBlockers(ex: ExerciseContent): string[] {
  const b: string[] = [];
  if (!ex.name.trim()) b.push('Nome ausente');
  if (!ex.objective.trim()) b.push('Objetivo ausente');
  if (!ex.audience.trim()) b.push('Público indicado ausente');
  if (ex.instructions.length === 0) b.push('Instruções ausentes');
  if (!ex.dose || Object.values(ex.dose).every((v) => v == null)) b.push('Dose/duração não definida pelo revisor');
  if (ex.stopIf.length === 0) b.push('Motivos para interromper ausentes');
  if (ex.references.length === 0) b.push('Referências ausentes');
  if (ex.media.kind !== 'none' && !ex.media.license) b.push('Licença da mídia não registrada');
  return b;
}

export function publishBlockers(ex: ExerciseContent): string[] {
  const b = reviewBlockers(ex);
  if (ex.isDemo) b.push('Conteúdo de demonstração não pode ser publicado');
  const r = ex.reviewer;
  if (!r || !r.name.trim() || !r.credential.trim()) b.push('Revisor e credencial ausentes');
  else {
    if (!r.credentialVerifiedAt) b.push('Credencial do revisor não verificada');
    if (!r.approvedAt) b.push('Data de aprovação ausente');
  }
  return b;
}

export class TransitionError extends Error {
  constructor(message: string, public readonly blockers: string[] = []) {
    super(message);
  }
}

export function transition(ex: ExerciseContent, to: ContentStatus, by: string, now: Date, note?: string): ExerciseContent {
  if (!ALLOWED[ex.status].includes(to)) {
    throw new TransitionError(`Transição não permitida: ${ex.status} → ${to}`);
  }
  if (to === 'in_review') {
    const blockers = reviewBlockers(ex);
    if (blockers.length) throw new TransitionError('Conteúdo incompleto para revisão', blockers);
  }
  if (to === 'published') {
    const blockers = publishBlockers(ex);
    if (blockers.length) throw new TransitionError('Publicação bloqueada', blockers);
  }
  return {
    ...ex,
    status: to,
    history: [...ex.history, { at: now.toISOString(), from: ex.status, to, by, note }],
  };
}

/** Campos cuja alteração muda o conteúdo clínico e exige nova revisão. */
const MATERIAL_FIELDS: (keyof ExerciseContent)[] = [
  'name', 'objective', 'audience', 'instructions', 'media', 'audioInstructionUri', 'dose', 'progression',
  'cautions', 'contraindications', 'stopIf', 'references', 'researchProtocol',
];

export function isMaterialChange(before: ExerciseContent, patch: Partial<ExerciseContent>): boolean {
  return MATERIAL_FIELDS.some((k) => k in patch && JSON.stringify(patch[k]) !== JSON.stringify(before[k]));
}

/**
 * Aplica uma edição. Em conteúdo publicado, uma mudança material cria nova versão em rascunho
 * (sem revisor); a versão publicada anterior continua valendo até a nova ser aprovada.
 */
export function edit(ex: ExerciseContent, patch: Partial<ExerciseContent>, by: string, now: Date): ExerciseContent {
  const { id: _i, version: _v, status: _s, history: _h, ...safe } = patch;
  if (ex.status === 'published' || ex.status === 'retired') {
    if (!isMaterialChange(ex, safe)) return ex;
    return {
      ...ex,
      ...safe,
      version: ex.version + 1,
      status: 'draft',
      reviewer: null,
      history: [{ at: now.toISOString(), from: null, to: 'draft', by, note: `Nova versão a partir da v${ex.version}` }],
    };
  }
  if (ex.status === 'in_review' && isMaterialChange(ex, safe)) {
    return {
      ...ex,
      ...safe,
      status: 'draft',
      reviewer: null,
      history: [...ex.history, { at: now.toISOString(), from: 'in_review', to: 'draft', by, note: 'Alteração durante a revisão' }],
    };
  }
  return { ...ex, ...safe };
}

/** Pode ser apresentado ao usuário como exercício aprovado? */
export function canOfferAsApproved(ex: ExerciseContent, flags: { clinicalContent: boolean }): boolean {
  return flags.clinicalContent && ex.status === 'published' && !ex.isDemo && publishBlockers(ex).length === 0;
}

/** Visível no app? Rascunhos só aparecem em modo de demonstração, sempre identificados. */
export function visibility(
  ex: ExerciseContent,
  ctx: { demoMode: boolean; clinicalContent: boolean },
): 'approved' | 'demo' | 'hidden' {
  if (canOfferAsApproved(ex, { clinicalContent: ctx.clinicalContent })) return 'approved';
  if (ctx.demoMode && (ex.isDemo || ex.status === 'draft' || ex.status === 'in_review')) return 'demo';
  return 'hidden';
}

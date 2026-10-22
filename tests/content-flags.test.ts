import { canOfferAsApproved, edit, ExerciseContent, transition, TransitionError, visibility } from '../src/domain/content';
import { resolveFlags } from '../src/domain/flags';
import { DEMO_EXERCISES } from '../src/content/demoExercises';

const now = new Date('2026-10-21T12:00:00Z');

function complete(over: Partial<ExerciseContent> = {}): ExerciseContent {
  return {
    id: 'ex1', version: 1, status: 'draft', name: 'Exercício', topic: 'lingua', objective: 'obj', audience: 'adultos',
    instructions: ['passo'], media: { kind: 'none' }, dose: { reps: 10 }, progression: null, cautions: [], contraindications: [],
    stopIf: ['dor'], references: [{ label: 'ref', url: 'https://example.org' }], reviewer: null, isDemo: false, history: [],
    ...over,
  };
}

const reviewer = { name: 'Revisora Real', credential: 'CRFa X', credentialVerifiedAt: '2026-10-01', approvedAt: '2026-10-02' };

describe('fluxo editorial', () => {
  test('não publica sem revisor verificado', () => {
    const r = transition(complete(), 'in_review', 'editor', now);
    expect(() => transition(r, 'published', 'editor', now)).toThrow(TransitionError);
    try { transition(r, 'published', 'editor', now); } catch (e) {
      expect((e as TransitionError).blockers).toContain('Revisor e credencial ausentes');
    }
  });

  test('não pula de rascunho direto para publicado', () => {
    expect(() => transition(complete({ reviewer }), 'published', 'x', now)).toThrow('Transição não permitida');
  });

  test('rascunho sem dose não entra em revisão (dose é do revisor)', () => {
    expect(() => transition(complete({ dose: null }), 'in_review', 'x', now)).toThrow(TransitionError);
  });

  test('publicação com revisor real; mudança material gera nova versão em rascunho', () => {
    const pub = transition(transition(complete({ reviewer }), 'in_review', 'x', now), 'published', 'revisora', now);
    expect(pub.status).toBe('published');
    expect(pub.history.map((h) => h.to)).toEqual(['in_review', 'published']);
    const changed = edit(pub, { dose: { reps: 20 } }, 'editor', now);
    expect(changed.status).toBe('draft');
    expect(changed.version).toBe(2);
    expect(changed.reviewer).toBeNull();
    // Mudança não material não altera o publicado.
    expect(edit(pub, { dose: { reps: 10 } }, 'editor', now)).toBe(pub);
  });

  test('conteúdo de demonstração nunca é publicado nem oferecido como aprovado', () => {
    const demo = complete({ isDemo: true, reviewer, status: 'in_review' });
    expect(() => transition(demo, 'published', 'x', now)).toThrow(TransitionError);
    expect(canOfferAsApproved({ ...demo, status: 'published' }, { clinicalContent: true })).toBe(false);
  });

  test('visibilidade: rascunho só em modo demonstração', () => {
    expect(visibility(complete(), { demoMode: false, clinicalContent: true })).toBe('hidden');
    expect(visibility(complete(), { demoMode: true, clinicalContent: true })).toBe('demo');
  });

  test('exercícios embarcados: rascunhos baseados em pesquisa, sem revisor, sem dose, nunca aprovados', () => {
    expect(DEMO_EXERCISES).toHaveLength(6);
    for (const e of DEMO_EXERCISES) {
      expect(e.status).toBe('draft');
      expect(e.reviewer).toBeNull();
      expect(e.dose).toBeNull();
      expect(e.references.some((r) => r.url.includes('25950418'))).toBe(true);
      expect(e.researchProtocol?.source).toBeTruthy();
      expect(e.stopIf.length).toBeGreaterThan(0);
      expect(canOfferAsApproved(e, { clinicalContent: true })).toBe(false);
      expect(visibility(e, { demoMode: false, clinicalContent: true })).toBe('hidden');
      expect(visibility(e, { demoMode: true, clinicalContent: true })).toBe('demo');
    }
  });

  test('conteúdo dos exercícios não inclui práticas proibidas nem promessas', () => {
    const text = JSON.stringify(DEMO_EXERCISES).toLowerCase();
    expect(text).not.toMatch(/fita|tape|prend(a|er) a respira[cç][aã]o por|apneia volunt|cura|garant|em 7 dias|elimina o ronco/);
  });

  test('rascunho não pode ser publicado sem revisor e dose', () => {
    expect(() => transition(DEMO_EXERCISES[0], 'in_review', 'x', now)).toThrow(TransitionError);
  });
});

describe('flags de módulos clínicos', () => {
  test('sem servidor, módulos clínicos ficam desligados', () => {
    const f = resolveFlags({ env: 'development', server: null, local: { clinical_content: true, diagnostic: true } });
    expect(f.clinical_content).toBe(false);
    expect(f.diagnostic).toBe(false);
  });

  test('diagnóstico nunca liga em produção, nem com servidor', () => {
    const f = resolveFlags({ env: 'production', server: { diagnostic: true, clinical_content: true } });
    expect(f.diagnostic).toBe(false);
    expect(f.clinical_content).toBe(true);
  });

  test('ajuste local só desliga', () => {
    expect(resolveFlags({ env: 'staging', server: { individual_triage: true }, local: { individual_triage: false } }).individual_triage).toBe(false);
  });
});

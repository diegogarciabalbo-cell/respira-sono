import { ExerciseContent, visibility } from '../domain/content';
import { ModuleFlag } from '../domain/flags';
import { DEMO_EXERCISES } from './demoExercises';

/**
 * Catálogo visível no app. Conteúdo publicado e revisado viria do servidor (tabela exercise_versions,
 * status 'published'). Sem servidor ou com o módulo clínico desligado, só aparecem rascunhos em modo
 * de demonstração, sempre identificados.
 */
export function visibleExercises(
  remotePublished: ExerciseContent[],
  ctx: { demoMode: boolean; flags: Record<ModuleFlag, boolean> },
): { item: ExerciseContent; mode: 'approved' | 'demo' }[] {
  const all = [...remotePublished, ...DEMO_EXERCISES];
  const out: { item: ExerciseContent; mode: 'approved' | 'demo' }[] = [];
  for (const item of all) {
    const v = visibility(item, { demoMode: ctx.demoMode, clinicalContent: ctx.flags.clinical_content });
    if (v !== 'hidden') out.push({ item, mode: v });
  }
  return out;
}

export function findExercise(id: string): ExerciseContent | undefined {
  return DEMO_EXERCISES.find((e) => e.id === id);
}

/**
 * Módulos com finalidade potencialmente médica ficam desligados por padrão.
 * O cliente só liga um módulo clínico quando o servidor também o liga; em produção,
 * funções diagnósticas permanecem desligadas até existir enquadramento regulatório documentado
 * (a mesma regra é aplicada no banco — ver supabase/migrations).
 */

export type ModuleFlag =
  | 'clinical_content' // exibir exercícios publicados como orientação aprovada
  | 'individual_triage' // triagem individual (questionários validados etc.)
  | 'diagnostic' // qualquer função diagnóstica futura
  | 'snore_classifier' // classificação experimental de ronco
  | 'cloud_sync'
  | 'professional_sharing';

export type AppEnv = 'development' | 'staging' | 'production';

const CLINICAL: ModuleFlag[] = ['clinical_content', 'individual_triage', 'diagnostic'];

export const DEFAULT_FLAGS: Record<ModuleFlag, boolean> = {
  clinical_content: false,
  individual_triage: false,
  diagnostic: false,
  snore_classifier: false,
  cloud_sync: false,
  professional_sharing: false,
};

export function resolveFlags(input: {
  env: AppEnv;
  server: Partial<Record<ModuleFlag, boolean>> | null;
  local?: Partial<Record<ModuleFlag, boolean>>;
}): Record<ModuleFlag, boolean> {
  const out = { ...DEFAULT_FLAGS };
  for (const key of Object.keys(out) as ModuleFlag[]) {
    const server = input.server?.[key];
    const local = input.local?.[key];
    if (CLINICAL.includes(key)) {
      // Módulo clínico: exige o servidor. Sem resposta do servidor = desligado.
      // Um ajuste local pode apenas desligar, nunca ligar.
      out[key] = server === true && local !== false;
    } else {
      out[key] = server ?? local ?? DEFAULT_FLAGS[key];
    }
  }
  if (input.env === 'production') out.diagnostic = false;
  return out;
}

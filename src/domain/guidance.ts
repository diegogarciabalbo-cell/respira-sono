/**
 * Regras de orientação ("próximos passos") a partir de SINTOMAS RELATADOS.
 *
 * Princípios:
 * - A função NÃO recebe resultados acústicos. Assim, uma noite com pouco som registrado
 *   nunca pode apagar uma orientação motivada por sintomas (regra de segurança do produto).
 * - Não gera diagnóstico, risco percentual nem pontuação clínica.
 * - Textos e regras são versionados e marcados como provisórios até revisão clínica real.
 */

export const GUIDANCE_RULES = {
  version: '0.1.0',
  reviewStatus: 'draft' as 'draft' | 'approved',
  reviewer: null as null | { name: string; credential: string; approvedAt: string },
  note: 'Texto provisório elaborado pela equipe de produto. Requer revisão por médico do sono antes do lançamento.',
};

export interface ReportedSymptoms {
  observedPauses?: boolean | null; // alguém viu pausas na respiração durante o sono
  recurrentChoking?: boolean | null; // acorda engasgado/sufocado com frequência
  daytimeSleepiness?: 1 | 2 | 3 | 4 | 5 | null; // autoavaliação 1 (nenhuma) a 5 (muita)
  drowsyDriving?: boolean | null; // sonolência ao dirigir
  severeBreathingNow?: boolean | null; // dificuldade respiratória intensa AGORA
  diagnosedApnea?: 'yes' | 'no' | 'unknown' | null;
  prescribedTreatment?: 'none' | 'cpap' | 'oral_appliance' | 'other' | null;
  morningHeadache?: boolean | null;
  hypertensionReported?: boolean | null;
}

export type StepLevel = 'urgent' | 'safety' | 'evaluate' | 'info';

export interface NextStep {
  id: string;
  level: StepLevel;
  title: string;
  body: string;
  rulesVersion: string;
}

const step = (id: string, level: StepLevel, title: string, body: string): NextStep => ({
  id, level, title, body, rulesVersion: GUIDANCE_RULES.version,
});

export function nextSteps(s: ReportedSymptoms): NextStep[] {
  const out: NextStep[] = [];

  if (s.severeBreathingNow) {
    out.push(step(
      'urgent-breathing',
      'urgent',
      'Procure atendimento imediato',
      'Se você está com dificuldade intensa para respirar agora, ligue 192 (SAMU) ou vá ao pronto-atendimento mais próximo. ' +
        'Este aplicativo não monitora a respiração em tempo real e não emite alertas.',
    ));
  }

  if (s.drowsyDriving) {
    out.push(step(
      'safety-driving',
      'safety',
      'Evite dirigir com sono',
      'Você relatou sonolência ao dirigir. Não dirija nem opere máquinas quando estiver sonolento e procure avaliação profissional para investigar a causa.',
    ));
  }

  const evaluateReasons: string[] = [];
  if (s.observedPauses) evaluateReasons.push('pausas na respiração observadas por outra pessoa');
  if (s.recurrentChoking) evaluateReasons.push('engasgos ou sensação de sufocamento ao dormir');
  if ((s.daytimeSleepiness ?? 0) >= 4) evaluateReasons.push('sonolência importante durante o dia');
  if (s.drowsyDriving) evaluateReasons.push('sonolência ao dirigir');

  if (evaluateReasons.length && s.diagnosedApnea !== 'yes') {
    out.push(step(
      'evaluate-sleep',
      'evaluate',
      'Converse com um profissional de saúde',
      `Você relatou ${joinPt(evaluateReasons)}. Esses sintomas podem justificar uma avaliação do sono com médico, ` +
        'que poderá indicar exames adequados, como polissonografia ou teste domiciliar. Uma gravação de áudio não confirma nem exclui apneia.',
    ));
  }

  if (s.diagnosedApnea === 'yes' || (s.prescribedTreatment && s.prescribedTreatment !== 'none')) {
    out.push(step(
      'keep-treatment',
      'info',
      'Mantenha o tratamento combinado com seu médico',
      'O aplicativo não ajusta nem substitui CPAP, aparelho intraoral ou medicamentos. Uma redução do ronco não indica, por si só, que a apneia foi resolvida. ' +
        'Leve seus registros à próxima consulta se achar útil.',
    ));
    if (evaluateReasons.length) {
      out.push(step(
        'evaluate-followup',
        'evaluate',
        'Conte ao seu médico sobre os sintomas',
        `Você relatou ${joinPt(evaluateReasons)} mesmo com diagnóstico ou tratamento. Vale informar seu médico.`,
      ));
    }
  }

  if (!out.some((x) => x.level !== 'info')) {
    out.push(step(
      'info-general',
      'info',
      'Acompanhe com regularidade',
      'Registre algumas noites em condições parecidas para observar tendências. Se surgirem pausas respiratórias observadas, engasgos ou sonolência diurna, procure avaliação.',
    ));
  }
  return out;
}

function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' e ' + items[items.length - 1];
}

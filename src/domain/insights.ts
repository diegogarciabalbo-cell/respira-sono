/**
 * Associações entre fatores do diário e resultados registrados.
 * São observações descritivas: sem causalidade, sempre com o número de noites e as diferenças de condição.
 */

export interface NightObservation {
  date: string;
  factors: Record<string, boolean | null | undefined>;
  /** valor numérico observado (ex.: descanso percebido 1–5) */
  outcome: number | null;
  /** chave de condição de gravação (aparelho + posição do telefone) para comparabilidade */
  conditionKey?: string | null;
}

export interface FactorComparison {
  factor: string;
  nWith: number;
  nWithout: number;
  meanWith: number | null;
  meanWithout: number | null;
  difference: number | null;
  enoughData: boolean;
  mixedConditions: boolean;
  statement: string;
}

export const MIN_NIGHTS_PER_GROUP = 3;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt = (x: number) => x.toFixed(1).replace('.', ',');

export function compareFactor(
  nights: NightObservation[],
  factor: string,
  labels: { factor: string; outcome: string },
): FactorComparison {
  const valid = nights.filter((n) => n.outcome != null && typeof n.factors[factor] === 'boolean');
  const withF = valid.filter((n) => n.factors[factor] === true).map((n) => n.outcome as number);
  const without = valid.filter((n) => n.factors[factor] === false).map((n) => n.outcome as number);
  const mW = mean(withF);
  const mWo = mean(without);
  const enough = withF.length >= MIN_NIGHTS_PER_GROUP && without.length >= MIN_NIGHTS_PER_GROUP;
  const conds = new Set(valid.map((n) => n.conditionKey ?? 'desconhecida'));
  const mixed = conds.size > 1;

  let statement: string;
  if (!enough) {
    statement =
      `Ainda não há noites suficientes para comparar ${labels.factor} (${withF.length} com, ${without.length} sem; ` +
      `mínimo de ${MIN_NIGHTS_PER_GROUP} em cada grupo).`;
  } else {
    statement =
      `Nas ${withF.length} noites com ${labels.factor}, ${labels.outcome} médio foi ${fmt(mW!)}; ` +
      `nas ${without.length} noites sem, foi ${fmt(mWo!)}. Isto é uma observação dos seus registros e não indica causa.` +
      (mixed ? ' As noites foram registradas em condições diferentes (aparelho ou posição), o que limita a comparação.' : '');
  }
  return {
    factor,
    nWith: withF.length,
    nWithout: without.length,
    meanWith: mW,
    meanWithout: mWo,
    difference: mW != null && mWo != null ? mW - mWo : null,
    enoughData: enough,
    mixedConditions: mixed,
    statement,
  };
}

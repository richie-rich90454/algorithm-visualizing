/**
 * propensity-score-matching.ts - Propensity Score Matching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Observational data lacks random assignment, so treated and control units can
 * differ in their observed covariates. Propensity score matching first fits a
 * logistic model that estimates each unit's probability of treatment given
 * its covariates, then pairs every treated unit with an unused control whose
 * estimated propensity is closest. The average difference in outcomes across
 * the matched pairs estimates the average treatment effect on the treated,
 * which is far less biased than comparing raw group means.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * n) to fit plus O(T * C) for greedy matching
 *   Space: O(n) for propensities, matches, and rendered units
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each unit is a point at (covariate, outcome); treated units are GREEN.
 *   - Fitted propensities replace node labels during the scoring phase.
 *   - A matched treated-control pair is joined by a GREEN edge.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Unit = { id: string; x: number; z: number; y: number };

const DEFAULT_UNITS: Unit[] = [
  { id: "T0", x: 1.6, z: 1, y: 8.1 },
  { id: "T1", x: 1.3, z: 1, y: 7.0 },
  { id: "T2", x: 1.8, z: 1, y: 8.8 },
  { id: "T3", x: 1.1, z: 1, y: 6.2 },
  { id: "T4", x: 1.5, z: 1, y: 7.7 },
  { id: "C0", x: 0.2, z: 0, y: 2.1 },
  { id: "C1", x: 0.5, z: 0, y: 3.4 },
  { id: "C2", x: 0.7, z: 0, y: 4.0 },
  { id: "C3", x: 0.9, z: 0, y: 4.8 },
  { id: "C4", x: 0.4, z: 0, y: 3.0 },
  { id: "C5", x: 0.6, z: 0, y: 3.7 },
  { id: "C6", x: 0.8, z: 0, y: 4.3 },
];

const sigmoid = (v: number): number => 1 / (1 + Math.exp(-v));

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as {
    units?: Unit[];
    learningRate?: number;
    iterations?: number;
  } | null) ?? {};
  const units = (task.units ?? DEFAULT_UNITS).map((u, i) => ({
    id: u.id ?? `u${i}`,
    x: u.x,
    z: u.z,
    y: u.y,
  }));
  const learningRate = typeof task.learningRate === "number" ? task.learningRate : 0.1;
  const iterations = typeof task.iterations === "number" ? Math.max(1, task.iterations | 0) : 500;
  const n = units.length;

  const makeNodes = (phase: "raw" | "score" | "match", active: number, score: number[]): VisualEntity[] =>
    units.map((unit, i) => {
      let state: EntityState = unit.z === 1 ? "sorted" : "unvisited";
      if (phase === "score" && i === active) state = "comparing";
      if (phase === "match" && unit.z === 1) state = "highlight";
      return {
        id: `unit-${i}`,
        type: "node" as const,
        label: phase === "raw" ? unit.id : score[i]?.toFixed(3) ?? "0",
        value: unit.y,
        state,
        x: unit.x,
        y: unit.y,
        width: 0,
        height: 0,
        metadata: { kind: unit.z === 1 ? "treated" : "control", x: unit.x, treatment: unit.z, outcome: unit.y },
      };
    });

  let index = 0;
  yield {
    stepNumber: index,
    entities: makeNodes("raw", -1, []),
    edges: [],
    description: `${n} units: ${units.filter((u) => u.z === 1).length} treated and ${units.filter((u) => u.z === 0).length} controls; fit a logistic propensity model.`,
    codeLineNumber: 0,
    layout: "point",
    meta: { n, iterations, learningRate },
  };
  index += 1;

  let b0 = 0;
  let b1 = 0;
  const checkpoint = Math.max(1, Math.floor(iterations / 4));
  for (let step = 1; step <= iterations; step += 1) {
    let g0 = 0;
    let g1 = 0;
    for (const unit of units) {
      const error = unit.z - sigmoid(b0 + b1 * unit.x);
      g0 += error;
      g1 += error * unit.x;
    }
    b0 += learningRate * g0;
    b1 += learningRate * g1;
    if (step % checkpoint === 0 || step === iterations) {
      yield {
        stepNumber: index,
        entities: makeNodes("raw", -1, []),
        edges: [],
        description: `Gradient step ${step}: intercept ${b0.toFixed(4)}, covariate coefficient ${b1.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { step, b0, b1 },
      };
      index += 1;
    }
  }

  const propensity = units.map((u) => sigmoid(b0 + b1 * u.x));
  for (let i = 0; i < n; i += 1) {
    yield {
      stepNumber: index,
      entities: makeNodes("score", i, propensity),
      edges: [],
      description: `Unit ${units[i]?.id} has propensity ${propensity[i]?.toFixed(4)} under the fitted model.`,
      codeLineNumber: 2,
      layout: "point",
      meta: { unit: i, b0, b1, propensity: propensity[i] ?? 0 },
    };
    index += 1;
  }

  const treated = units.map((u, i) => ({ u, i })).filter((e) => e.u.z === 1);
  const available = new Set(units.map((u, i) => (u.z === 0 ? i : -1)).filter((i) => i >= 0));
  const pairs: Array<[number, number]> = [];
  const edges: VisualEdge[] = [];
  for (const { u: treatedUnit, i: ti } of treated) {
    let best = -1;
    let bestDistance = Infinity;
    for (const ci of available) {
      const distance = Math.abs((propensity[ti] ?? 0) - (propensity[ci] ?? 0));
      if (distance < bestDistance - 1e-12 || (Math.abs(distance - bestDistance) <= 1e-12 && (best < 0 || ci < best))) {
        best = ci;
        bestDistance = distance;
      }
    }
    if (best < 0) break;
    available.delete(best);
    pairs.push([ti, best]);
    edges.push({
      id: `match-${ti}-${best}`,
      sourceId: `unit-${ti}`,
      targetId: `unit-${best}`,
      label: `d=${bestDistance.toFixed(3)}`,
      state: "path" as EntityState,
      directed: false,
    });
    yield {
      stepNumber: index,
      entities: makeNodes("match", ti, propensity),
      edges: edges.map((e) => ({ ...e })),
      description: `Matched treated unit ${treatedUnit.id} to control ${units[best]?.id}; propensity gap ${bestDistance.toFixed(4)}, ${available.size} controls remain.`,
      codeLineNumber: 3,
      layout: "point",
      meta: { treated: ti, control: best, distance: bestDistance, matched: pairs.length },
    };
    index += 1;
  }

  let effect = 0;
  for (const [ti, ci] of pairs) {
    effect += (units[ti]?.y ?? 0) - (units[ci]?.y ?? 0);
  }
  const att = pairs.length > 0 ? effect / pairs.length : 0;
  const rawTreated = treated.reduce((a, e) => a + e.u.y, 0) / Math.max(1, treated.length);
  const rawControl =
    units.filter((u) => u.z === 0).reduce((a, u) => a + u.y, 0) / Math.max(1, available.size + pairs.length);
  yield {
    stepNumber: index,
    entities: makeNodes("match", -1, propensity),
    edges: edges.map((e) => ({ ...e })),
    description: `ATT from ${pairs.length} matched pairs is ${att.toFixed(4)}, versus a raw group gap of ${(rawTreated - rawControl).toFixed(4)}.`,
    codeLineNumber: 5,
    layout: "point",
    meta: {
      b0,
      b1,
      att,
      rawGap: rawTreated - rawControl,
      matched: pairs.length,
      pairs: pairs.map(([ti, ci]) => `${ti}->${ci}`),
    },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "In an observational study, treated and untreated units may differ before treatment, so a raw outcome gap mixes the treatment effect with those pre-existing differences. Propensity score matching compresses all covariates into a single number: the estimated chance of receiving treatment. Pairing each treated unit with a control of similar propensity balances the observed covariates, and the average within-pair outcome difference estimates the effect on the treated.",
    invariants: [
      "Propensities come from the fitted logistic model and lie strictly between zero and one.",
      "Each control is used in at most one matched pair because it is removed from the available set when selected.",
      "The ATT is the mean of the within-pair outcome differences.",
    ],
    correctness:
      "If treatment is ignorable given the covariates, then conditioning on the propensity score also balances those covariates. Matching on that scalar therefore removes the confounding attributable to observed variables. Greedy nearest-neighbor matching chooses the available control with minimal propensity distance, and averaging the paired differences yields an unbiased estimate of the average treatment effect on the treated under the ignorability and overlap assumptions.",
    complexityRationale:
      "Each gradient step evaluates every unit once, costing O(iterations*n). Greedy matching compares each of the T treated units against all C available controls, costing O(T*C). Storing propensities, the available set, and the match list takes O(n) space.",
    uses: [
      "Estimating treatment effects from observational health records",
      "Evaluating policy interventions without randomized trials",
      "Reducing confounding in marketing and econometric studies",
    ],
    references: [
      "Rosenbaum and Rubin, The Central Role of the Propensity Score in Observational Studies for Causal Effects, 1983",
      "Stuart, Matching Methods for Causal Inference, Statistical Science, 2010",
    ],
    workedExample:
      "With five treated units whose covariates lie above 1.0 and seven controls below 1.0, logistic regression assigns higher propensities to the treated group. Matching each treated unit to the closest unused control produces five pairs. If the average treated outcome is 7.56 and the matched controls average 3.86, the estimated ATT is about 3.70.",
  },
  id: "propensity-score-matching",
  name: "Propensity Score Matching",
  category: "statistics-probability",
  complexity: { time: "O(iterations * n + T * C)", space: "O(n)" },
  defaultInput: { units: DEFAULT_UNITS, learningRate: 0.1, iterations: 500 },
  visualType: "point",
  run,
  pseudocode: [
    "input units with covariate, treatment flag, and outcome",
    "fit logistic model by gradient steps on the log loss",
    "compute each unit's propensity from the fitted coefficients",
    "sort treated units and find the nearest unused control by propensity",
    "remove each matched control and record the outcome difference",
    "average the paired differences to estimate the treatment effect",
  ],
};

export default module;

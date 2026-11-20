/**
 * ordinal-logistic-regression.ts - Ordinal Logistic Regression (proportional odds)
 *
 * The proportional-odds model assigns cumulative probabilities to ordered
 * categories with logit(P(Y <= j | x)) = theta_j - beta x, where the thresholds
 * theta_j are increasing. Category probabilities are successive differences of
 * those cumulative probabilities. A gradient-ascent fit maximizes the log
 * likelihood of the observed categories.
 *
 * Time: O(iterations * observations * categories). Space: O(categories).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface OrdinalDatum {
  x: number;
  y: number;
}

export const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

/** Ordered category probabilities for one covariate value. */
export function ordinalProbs(thresholds: number[], beta: number, x: number): number[] {
  const k = thresholds.length + 1;
  const cumulative: number[] = [];
  for (let j = 0; j < k - 1; j += 1) cumulative.push(sigmoid((thresholds[j] ?? 0) - beta * x));
  const probs: number[] = [];
  let previous = 0;
  for (let j = 0; j < k - 1; j += 1) {
    probs.push((cumulative[j] ?? 0) - previous);
    previous = cumulative[j] ?? 0;
  }
  probs.push(1 - previous);
  return probs;
}

export function ordinalLogLikelihood(
  thresholds: number[],
  beta: number,
  data: OrdinalDatum[],
): number {
  let total = 0;
  for (const datum of data) {
    const probs = ordinalProbs(thresholds, beta, datum.x);
    const p = probs[Math.max(0, Math.min(probs.length - 1, Math.floor(datum.y)))] ?? 1e-12;
    total += Math.log(Math.max(1e-12, p));
  }
  return total;
}

/** Gradient ascent with central-difference derivatives. */
export function fitOrdinal(
  thresholds0: number[],
  beta0: number,
  data: OrdinalDatum[],
  iterations: number,
  learningRate: number,
): { thresholds: number[]; beta: number; logLikelihood: number; trace: number[] } {
  const thresholds = [...thresholds0];
  let beta = beta0;
  const trace: number[] = [ordinalLogLikelihood(thresholds, beta, data)];
  const h = 1e-5;
  for (let step = 0; step < iterations; step += 1) {
    const gradients = thresholds.map((_, idx) => {
      const plus = [...thresholds];
      const minus = [...thresholds];
      plus[idx] = (plus[idx] ?? 0) + h;
      minus[idx] = (minus[idx] ?? 0) - h;
      return (
        (ordinalLogLikelihood(plus, beta, data) - ordinalLogLikelihood(minus, beta, data)) /
        (2 * h)
      );
    });
    const gradBeta =
      (ordinalLogLikelihood(thresholds, beta + h, data) -
        ordinalLogLikelihood(thresholds, beta - h, data)) /
      (2 * h);
    for (let j = 0; j < thresholds.length; j += 1) {
      thresholds[j] = (thresholds[j] ?? 0) + learningRate * (gradients[j] ?? 0);
    }
    beta += learningRate * gradBeta;
    trace.push(ordinalLogLikelihood(thresholds, beta, data));
  }
  return { thresholds, beta, logLikelihood: trace[trace.length - 1] as number, trace };
}

function probabilityBars(probs: number[], active: number): VisualEntity[] {
  return probs.map((p, i) => {
    let state: EntityState = "unvisited";
    if (i === active) state = "comparing";
    if (i === probs.length - 1) state = i === active ? "active" : "sorted";
    return {
      id: `cat-${i}`,
      type: "bar" as const,
      label: `P(Y=${i})=${p.toFixed(3)}`,
      value: p,
      state,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      metadata: { category: i, probability: p },
    };
  });
}

function likelihoodBars(trace: number[], active: number): VisualEntity[] {
  const shown = trace.slice(0, 16);
  return shown.map((value, i) => ({
    id: `iter-${i}`,
    type: "bar" as const,
    label: `iter ${i}: ${value.toFixed(3)}`,
    value,
    state: (i === active ? "comparing" : i < active ? "sorted" : "unvisited") as EntityState,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    metadata: { iteration: i, logLikelihood: value },
  }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as {
    thresholds?: number[];
    beta?: number;
    x?: number;
    data?: OrdinalDatum[];
    iterations?: number;
    learningRate?: number;
  } | null) ?? {};
  const thresholds = Array.isArray(task.thresholds) && task.thresholds.length >= 1
    ? task.thresholds.map(Number)
    : [-0.5, 1];
  const beta = Number.isFinite(Number(task.beta)) ? Number(task.beta) : 0.8;
  const x = Number.isFinite(Number(task.x)) ? Number(task.x) : 0.5;
  const data = Array.isArray(task.data) && task.data.length > 0
    ? task.data
    : [
        { x: -1, y: 0 },
        { x: -0.5, y: 0 },
        { x: 0, y: 1 },
        { x: 0.5, y: 1 },
        { x: 1, y: 2 },
        { x: 1.5, y: 2 },
      ];
  const iterations = Math.max(1, Math.min(200, Math.floor(Number(task.iterations ?? 40)) || 40));
  const learningRate = Number(task.learningRate) > 0 ? Number(task.learningRate) : 0.1;

  const initial = ordinalProbs(thresholds, beta, x);
  let index = 0;
  yield {
    stepNumber: index,
    entities: probabilityBars(initial, -1),
    edges: [],
    description: `Proportional-odds model with ${thresholds.length} thresholds and beta ${beta} at x=${x}.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { thresholds, beta, x, categories: initial.length },
  };
  index += 1;

  const fit = fitOrdinal(thresholds, beta, data, iterations, learningRate);
  const shown = Math.min(iterations, 16);
  for (let i = 0; i < shown; i += 1) {
    yield {
      stepNumber: index,
      entities: likelihoodBars(fit.trace.slice(0, i + 1), i),
      edges: [],
      description: `Gradient step ${i}: log likelihood ${(fit.trace[i] ?? 0).toFixed(4)}.`,
      codeLineNumber: 3,
      layout: "array",
      meta: { iteration: i, logLikelihood: fit.trace[i] ?? 0, thresholds: fit.thresholds, beta: fit.beta },
    };
    index += 1;
  }

  const finalProbs = ordinalProbs(fit.thresholds, fit.beta, x);
  yield {
    stepNumber: index,
    entities: probabilityBars(finalProbs, -1),
    edges: [],
    description: `Fitted beta ${fit.beta.toFixed(4)}; category probabilities at x=${x} sum to one.`,
    codeLineNumber: 5,
    layout: "array",
    meta: {
      thresholds: fit.thresholds,
      beta: fit.beta,
      x,
      probabilities: finalProbs,
      logLikelihood: fit.logLikelihood,
      improved: fit.logLikelihood >= (fit.trace[0] as number),
      done: true,
    },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "For an ordered response such as low, medium or high, the proportional-odds model imagines a single latent score that shifts linearly with the covariate. Fixed cut points turn that score into category probabilities, so increasing the covariate moves probability toward higher categories. A common slope beta keeps the cumulative logit curves parallel.",
    invariants: [
      "Cumulative probabilities sigmoid(theta_j - beta x) increase with j.",
      "Category probabilities are successive differences and sum to one.",
      "Each gradient step does not decrease the log likelihood for a small enough learning rate.",
    ],
    correctness:
      "The thresholds are ordered, so each cumulative probability is larger than the last and every successive difference is nonnegative; the final difference from one to the last cumulative is also nonnegative, and the telescoping sum is one. The likelihood is a smooth function of the parameters, and gradient ascent with central-difference derivatives moves along its increasing direction, converging to a local maximum where the gradient vanishes.",
    complexityRationale:
      "Each gradient step evaluates the likelihood twice per parameter using central differences, and each likelihood evaluation visits every observation and category, giving O(iterations * observations * categories) time and O(categories) space.",
    uses: [
      "Modeling ordered survey responses and Likert scales",
      "Predicting disease severity grades from biomarkers",
      "Credit rating and ordered risk category prediction",
    ],
    references: [
      "McCullagh, Regression Models for Ordinal Data, 1980",
      "Agresti, Analysis of Ordinal Categorical Data, 2nd edition",
    ],
    workedExample:
      "With thresholds -0.5 and 1, beta 0.8 and x 0.5, the cumulative logits are -0.9 and 0.6, giving cumulative probabilities 0.289 and 0.646. The category probabilities are 0.289, 0.357 and 0.354, which sum to one.",
  },
  id: "ordinal-logistic-regression",
  name: "Ordinal Logistic Regression",
  category: "statistics-probability",
  complexity: { time: "O(iterations * observations * categories)", space: "O(categories)" },
  defaultInput: {
    thresholds: [-0.5, 1],
    beta: 0.8,
    x: 0.5,
    iterations: 40,
    learningRate: 0.1,
  },
  visualType: "array",
  run,
  pseudocode: [
    "input increasing thresholds, slope beta, and labeled data",
    "compute cumulative probabilities sigmoid(theta_j - beta x)",
    "take successive differences to get ordered category probabilities",
    "sum the log probability of the observed category over all rows",
    "estimate derivatives by central differences and step uphill",
    "repeat for a fixed number of gradient steps",
    "done: report fitted parameters and final category probabilities",
  ],
};

export default module;

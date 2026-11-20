/**
 * thermodynamic-integration.ts - Thermodynamic Integration for Model Evidence
 *
 * Thermodynamic integration computes a normalizing constant by heating a
 * distribution from the prior at beta = 0 to the posterior at beta = 1. The
 * log evidence equals the integral over beta of the expected log likelihood
 * under the tempered distribution. For conjugate Gaussian prior and likelihood
 * that expectation has a closed form, which makes the method exactly checkable.
 *
 * Time: O(steps). Space: O(steps).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Expected log likelihood under N(mp,vp) tempered by N(ml,vl) to power beta. */
export function expectedLogLikelihood(
  beta: number,
  priorMean: number,
  priorVar: number,
  likelihoodMean: number,
  likelihoodVar: number,
): number {
  const precision = 1 / priorVar + beta / likelihoodVar;
  const mean = (priorMean / priorVar + (beta * likelihoodMean) / likelihoodVar) / precision;
  const variance = 1 / precision;
  const deviation = variance + (mean - likelihoodMean) ** 2;
  return (
    -0.5 * Math.log(2 * Math.PI * likelihoodVar) - deviation / (2 * likelihoodVar)
  );
}

/** Trapezoidal integral of values sampled at ascending x positions. */
export function trapezoidalIntegral(xs: number[], values: number[]): number {
  let total = 0;
  for (let i = 1; i < xs.length; i += 1) {
    total += ((xs[i] as number) - (xs[i - 1] as number)) *
      (((values[i] as number) + (values[i - 1] as number)) / 2);
  }
  return total;
}

/** Simpson integral on an evenly spaced grid with an odd number of points. */
export function simpsonIntegral(values: number[], lower: number, upper: number): number {
  const n = values.length - 1;
  const h = (upper - lower) / n;
  let total = (values[0] as number) + (values[n] as number);
  for (let i = 1; i < n; i += 1) total += (i % 2 === 0 ? 2 : 4) * (values[i] as number);
  return (h * total) / 3;
}

export function gaussianEvidenceViaTI(steps: number, priorVar: number, likelihoodVar: number, mean: number): number {
  const count = Math.max(3, steps % 2 === 0 ? steps + 1 : steps);
  const betas = Array.from({ length: count }, (_, i) => i / (count - 1));
  const values = betas.map((beta) =>
    expectedLogLikelihood(beta, 0, priorVar, mean, likelihoodVar),
  );
  return Math.exp(simpsonIntegral(values, 0, 1));
}

function bars(values: number[], active: number): VisualEntity[] {
  return values.map((value, i) => ({
    id: `beta-${i}`,
    type: "bar" as const,
    label: `beta ${(i / Math.max(1, values.length - 1)).toFixed(2)}: ${value.toFixed(3)}`,
    value,
    state: (i === active ? "comparing" : i < active ? "sorted" : "unvisited") as EntityState,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    metadata: { beta: i / Math.max(1, values.length - 1), expectation: value },
  }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as {
    steps?: number;
    priorMean?: number;
    priorVar?: number;
    likelihoodMean?: number;
    likelihoodVar?: number;
  } | null) ?? {};
  const steps = Math.max(3, Math.min(101, Math.floor(Number(task.steps ?? 21)) || 21));
  const count = steps % 2 === 0 ? steps + 1 : steps;
  const priorMean = Number.isFinite(Number(task.priorMean)) ? Number(task.priorMean) : 0;
  const priorVar = Number(task.priorVar) > 0 ? Number(task.priorVar) : 1;
  const likelihoodMean = Number.isFinite(Number(task.likelihoodMean)) ? Number(task.likelihoodMean) : 1;
  const likelihoodVar = Number(task.likelihoodVar) > 0 ? Number(task.likelihoodVar) : 1;

  const betas = Array.from({ length: count }, (_, i) => i / (count - 1));
  const values = betas.map((beta) =>
    expectedLogLikelihood(beta, priorMean, priorVar, likelihoodMean, likelihoodVar),
  );
  const logZ = simpsonIntegral(values, 0, 1);
  const evidence = Math.exp(logZ);
  const priorStd = Math.sqrt(priorVar);
  const likelihoodStd = Math.sqrt(likelihoodVar);
  const combinedVar = (priorVar * likelihoodVar) / (priorVar + likelihoodVar);
  const closedForm =
    Math.exp(-((likelihoodMean - priorMean) ** 2) / (2 * (priorVar + likelihoodVar))) /
    Math.sqrt(2 * Math.PI * (priorVar + likelihoodVar));

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(values, -1),
    edges: [],
    description: `Thermodynamic integration over ${count} betas from prior to tempered posterior.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { steps: count, priorMean, priorVar, likelihoodMean, likelihoodVar },
  };
  index += 1;

  const shown = Math.min(count, 12);
  for (let i = 0; i < shown; i += 1) {
    yield {
      stepNumber: index,
      entities: bars(values, i),
      edges: [],
      description: `Beta ${(betas[i] as number).toFixed(3)}: expected log likelihood ${(values[i] as number).toFixed(4)}.`,
      codeLineNumber: 2,
      layout: "array",
      meta: { beta: betas[i] as number, expectation: values[i] as number },
    };
    index += 1;
  }

  yield {
    stepNumber: index,
    entities: bars(values, count - 1),
    edges: [],
    description: `Integrated log evidence ${logZ.toFixed(4)}, evidence ${evidence.toFixed(5)}, closed form ${closedForm.toFixed(5)}.`,
    codeLineNumber: 4,
    layout: "array",
    meta: { logZ, evidence, closedForm, priorStd, likelihoodStd, combinedVar, done: true },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Thermodynamic integration turns a hard normalizing-constant problem into an integral. Introduce an inverse temperature beta that ramps from zero, where the distribution is the prior, to one, where it is the posterior. The derivative of the log normalizing constant with respect to beta is the average log likelihood at that temperature, so integrating those averages recovers the log evidence.",
    invariants: [
      "At beta zero the tempered distribution equals the prior; at beta one it equals the posterior.",
      "The integrand is the expected log likelihood under the tempered distribution.",
      "The integral is independent of the path parameterization, only depending on the endpoints.",
    ],
    correctness:
      "Let Z(beta) integrate prior(x) likelihood(x)^beta. Differentiating log Z gives the expectation of log likelihood under the tempered density p_beta, which is exactly the sampled integrand. Integrating that derivative from zero to one telescopes to log Z(1) minus log Z(0), and Z(0) is one because the prior is normalized, so the integral equals the log evidence. The conjugate Gaussian case makes every term explicit and confirms the result.",
    complexityRationale:
      "With a fixed number of temperature rungs the method evaluates one expectation per rung and integrates them with Simpson's rule, costing O(steps) time and O(steps) space to display the ladder.",
    uses: [
      "Bayesian model comparison and Bayes factors",
      "Estimating partition functions in statistical physics",
      "Normalizing constants for latent-variable and energy-based models",
    ],
    references: [
      "Kirkwood, Statistical Mechanics of an Irreversible Process, 1935",
      "Gelman and Meng, Simulating Normalizing Constants, 1998",
    ],
    workedExample:
      "For a standard normal prior and a N(1,1) likelihood the evidence is N(1; 0, sqrt(2)), about 0.2197. The integrand at beta zero is the prior-average log likelihood, and at beta one it is the posterior-average. Simpson's rule over an odd grid of betas integrates them to log evidence about -1.5155, whose exponential is 0.2197.",
  },
  id: "thermodynamic-integration",
  name: "Thermodynamic Integration",
  category: "statistics-probability",
  complexity: { time: "O(steps)", space: "O(steps)" },
  defaultInput: { steps: 21, priorMean: 0, priorVar: 1, likelihoodMean: 1, likelihoodVar: 1 },
  visualType: "array",
  run,
  pseudocode: [
    "input temperature ladder from beta zero to one",
    "at each beta form the tempered distribution prior times likelihood^beta",
    "compute the expected log likelihood under that tempered law",
    "integrate the expectations over beta with Simpson's rule",
    "exponentiate the integral to obtain the model evidence",
    "done: compare the estimate with the closed-form Gaussian evidence",
  ],
};

export default module;

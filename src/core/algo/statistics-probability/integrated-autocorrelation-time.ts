/**
 * integrated-autocorrelation-time.ts - Integrated Autocorrelation Time
 *
 * Markov chain samples are correlated, so the effective number of independent
 * draws is smaller than the chain length. The integrated autocorrelation time
 * sums the autocorrelation function, using Geyer's initial positive sequence
 * to truncate before Monte Carlo noise turns the estimate negative. The
 * effective sample size is the chain length divided by tau.
 *
 * Time: O(n * maxLag). Space: O(maxLag).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Normalized autocorrelation at a given lag. */
export function autocorrelation(series: number[], lag: number): number {
  const n = series.length;
  if (lag < 0 || lag >= n) return 0;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const deviation = (series[i] as number) - mean;
    denominator += deviation * deviation;
    if (i + lag < n) numerator += deviation * ((series[i + lag] as number) - mean);
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

export interface IatResult {
  tau: number;
  effectiveSampleSize: number;
  groups: number[];
  rhos: number[];
}

/** Estimate tau via the initial positive sequence of paired autocorrelations. */
export function integratedAutocorrelationTime(series: number[], maxLag: number): IatResult {
  const limit = Math.min(maxLag, series.length - 1);
  const rhos = Array.from({ length: limit + 1 }, (_, k) => autocorrelation(series, k));
  const groups: number[] = [];
  for (let t = 0; 2 * t + 1 < rhos.length; t += 1) {
    const pair = (rhos[2 * t] as number) + (rhos[2 * t + 1] as number);
    groups.push(pair);
    if (pair <= 0) break;
  }
  const tau = Math.max(1, -1 + 2 * groups.reduce((a, b) => a + b, 0));
  return { tau, effectiveSampleSize: series.length / tau, groups, rhos };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic AR(1) chain with standard normal innovations. */
export function ar1Chain(n: number, phi: number, seed: number): number[] {
  const random = mulberry32(seed);
  const series: number[] = [0];
  for (let i = 1; i < n; i += 1) {
    const u1 = Math.max(1e-12, random());
    const u2 = random();
    const innovation = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    series.push(phi * (series[i - 1] as number) + innovation);
  }
  return series;
}

function bars(values: number[], active: number): VisualEntity[] {
  return values.map((value, i) => ({
    id: `lag-${i}`,
    type: "bar" as const,
    label: `lag ${i}: ${value.toFixed(3)}`,
    value,
    state: (i === active ? "comparing" : i < active ? "sorted" : "unvisited") as EntityState,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    metadata: { lag: i, autocorrelation: value },
  }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { length?: number; phi?: number; maxLag?: number; seed?: number } | null) ?? {};
  const length = Math.max(100, Math.min(20000, Math.floor(Number(task.length ?? 4000)) || 4000));
  const phi = Math.max(-0.95, Math.min(0.95, Number.isFinite(Number(task.phi)) ? Number(task.phi) : 0.7));
  const maxLag = Math.max(4, Math.min(100, Math.floor(Number(task.maxLag ?? 40)) || 40));
  const seed = Math.floor(Number(task.seed ?? 13)) || 13;

  const series = ar1Chain(length, phi, seed);
  const result = integratedAutocorrelationTime(series, maxLag);

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(result.rhos, -1),
    edges: [],
    description: `Autocorrelation of an AR(1) chain of length ${length} with phi ${phi}.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { length, phi, maxLag, seed },
  };
  index += 1;

  const shown = Math.min(result.rhos.length, 12);
  for (let i = 0; i < shown; i += 1) {
    yield {
      stepNumber: index,
      entities: bars(result.rhos, i),
      edges: [],
      description: `Lag ${i}: autocorrelation ${(result.rhos[i] as number).toFixed(4)}.`,
      codeLineNumber: 2,
      layout: "array",
      meta: { lag: i, autocorrelation: result.rhos[i] as number },
    };
    index += 1;
  }

  const analytic = (1 + phi) / (1 - phi);
  yield {
    stepNumber: index,
    entities: bars(result.rhos, result.rhos.length - 1),
    edges: [],
    description: `Integrated autocorrelation time ${result.tau.toFixed(3)} versus AR(1) analytic ${analytic.toFixed(3)}; effective sample size ${result.effectiveSampleSize.toFixed(1)}.`,
    codeLineNumber: 4,
    layout: "array",
    meta: { tau: result.tau, analytic, effectiveSampleSize: result.effectiveSampleSize, groups: result.groups, done: true },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Successive samples of a Markov chain resemble each other, so a chain of ten thousand steps may carry far less than ten thousand independent pieces of information. The integrated autocorrelation time measures how many steps separate effectively independent draws. It sums the autocorrelation curve up to the point where Monte Carlo noise takes over, and the effective sample size is the chain length divided by that time.",
    invariants: [
      "Autocorrelation at lag zero is one.",
      "Grouped autocorrelations are summed only while they remain positive.",
      "The effective sample size is the chain length over tau and is at most the chain length.",
    ],
    correctness:
      "For a stationary reversible chain the variance of a Monte Carlo mean is inflated by the factor tau, which equals one plus twice the sum of autocorrelations at positive lags. Geyer's initial positive sequence groups adjacent lags and truncates at the first nonpositive pair, which removes noise without biasing the estimate downward. For an AR(1) chain the autocorrelations are phi to the lag k, and the geometric sum gives the analytic tau of (1+phi)/(1-phi).",
    complexityRationale:
      "Each lag compares all pairs of samples separated by that lag, costing O(n) per lag and O(n * maxLag) overall, with O(maxLag) space for the autocorrelation curve.",
    uses: [
      "Diagnosing convergence and mixing of MCMC samplers",
      "Reporting effective sample size in Bayesian software",
      "Setting chain length for a target Monte Carlo accuracy",
    ],
    references: [
      "Geyer, Practical Markov Chain Monte Carlo, 1992",
      "Stan Development Team, Stan User's Guide, effective sample size section",
    ],
    workedExample:
      "For an AR(1) chain with phi 0.7 the autocorrelations are 1, 0.7, 0.49, 0.343 and so on. Pairing gives groups 1.7, 0.833, 0.408, whose sum is about 3.33. The tau estimate is minus one plus twice that, about 5.67, matching (1+0.7)/(1-0.7). A chain of 4000 steps then has roughly 705 effective samples.",
  },
  id: "integrated-autocorrelation-time",
  name: "Integrated Autocorrelation Time",
  category: "statistics-probability",
  complexity: { time: "O(n * maxLag)", space: "O(maxLag)" },
  defaultInput: { length: 20000, phi: 0.7, maxLag: 50, seed: 13 },
  visualType: "array",
  run,
  pseudocode: [
    "input a stationary chain and a maximum lag",
    "compute the normalized autocorrelation at each lag up to the maximum",
    "group adjacent autocorrelations into paired sums",
    "sum pairs while they remain positive, stopping at the first nonpositive pair",
    "set tau to minus one plus twice the accumulated sum",
    "divide the chain length by tau for the effective sample size",
    "done: report tau and the effective sample size",
  ],
};

export default module;

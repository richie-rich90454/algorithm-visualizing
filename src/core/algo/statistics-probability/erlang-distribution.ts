/**
 * erlang-distribution.ts - Erlang Distribution (density, CDF, inverse transform)
 *
 * The Erlang distribution with integer shape k and rate lambda is the gamma
 * distribution restricted to integer shapes. Its density is
 * lambda^k x^(k-1) exp(-lambda x) / (k-1)! and its CDF is the probability that
 * a Poisson(lambda x) count reaches k. Because the CDF is built from a finite
 * sum, it evaluate in O(k) and inverts by bisection for exact sampling.
 *
 * Time: O(bins * k + samples * k * log range). Space: O(bins).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function erlangPdf(x: number, k: number, lambda: number): number {
  if (x < 0) return 0;
  if (x === 0) return k === 1 ? lambda : 0;
  let logFactorial = 0;
  for (let i = 2; i <= k - 1; i += 1) logFactorial += Math.log(i);
  return Math.exp(k * Math.log(lambda) + (k - 1) * Math.log(x) - lambda * x - logFactorial);
}

export function erlangCdf(x: number, k: number, lambda: number): number {
  if (x <= 0) return 0;
  const lx = lambda * x;
  let sum = 0;
  let term = 1;
  for (let j = 0; j < k; j += 1) {
    if (j > 0) term = (term * lx) / j;
    sum += term;
  }
  return 1 - Math.exp(-lx) * sum;
}

export function erlangQuantile(u: number, k: number, lambda: number): number {
  const target = Math.min(1 - 1e-12, Math.max(1e-12, u));
  let lo = 0;
  let hi = 1 / lambda;
  while (erlangCdf(hi, k, lambda) < target) hi *= 2;
  for (let i = 0; i < 100; i += 1) {
    const mid = (lo + hi) / 2;
    if (erlangCdf(mid, k, lambda) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function bars(
  centers: number[],
  counts: number[],
  pdf: number[],
  active: number,
  evaluated: number,
  showCounts: boolean,
): VisualEntity[] {
  return centers.map((x, i) => {
    let state: EntityState = "unvisited";
    if (i < evaluated) state = "sorted";
    if (i === active) state = showCounts ? "active" : "comparing";
    return {
      id: `bar-${i}`,
      type: "bar" as const,
      label: showCounts ? String(counts[i] ?? 0) : (pdf[i] ?? 0).toFixed(3),
      value: showCounts ? (counts[i] ?? 0) : (pdf[i] ?? 0),
      state,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      metadata: { index: i, x, density: pdf[i] ?? 0 },
    };
  });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as {
    shape?: number;
    rate?: number;
    xMax?: number;
    bins?: number;
    samples?: number;
    seed?: number;
  } | null) ?? {};
  const k = Math.max(1, Math.min(20, Math.floor(Number(task.shape ?? 3)) || 3));
  const lambda = Number(task.rate) > 0 ? Number(task.rate) : 1.5;
  const xMax = Number(task.xMax) > 0 ? Number(task.xMax) : (k + 4) / lambda;
  const bins = Math.max(4, Math.min(40, Math.floor(Number(task.bins ?? 16)) || 16));
  const samples = Math.max(1, Math.min(5000, Math.floor(Number(task.samples ?? 300)) || 300));
  const seed = Math.floor(Number(task.seed ?? 7)) || 7;

  const step = xMax / bins;
  const centers = Array.from({ length: bins }, (_, i) => (i + 0.5) * step);
  const density = centers.map((x) => erlangPdf(x, k, lambda));
  const counts = new Array<number>(bins).fill(0);

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(centers, counts, density, -1, 0, false),
    edges: [],
    description: `Erlang density with shape ${k} and rate ${lambda} across ${bins} bins over 0 to ${xMax.toFixed(2)}.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { shape: k, rate: lambda, bins, xMax },
  };
  index += 1;

  for (let i = 0; i < bins; i += 1) {
    const x = centers[i] as number;
    yield {
      stepNumber: index,
      entities: bars(centers, counts, density, i, i, false),
      edges: [],
      description: `Bin ${i}: x=${x.toFixed(3)}, density=${erlangPdf(x, k, lambda).toFixed(4)}, CDF=${erlangCdf(x, k, lambda).toFixed(4)}.`,
      codeLineNumber: 1,
      layout: "array",
      meta: { shape: k, rate: lambda, x, density: erlangPdf(x, k, lambda), cdf: erlangCdf(x, k, lambda) },
    };
    index += 1;
  }

  const rng = makeRng(seed);
  const shownU: number[] = [];
  const shownX: number[] = [];
  const shown = Math.min(samples, 10);
  for (let s = 0; s < samples; s += 1) {
    const u = Math.max(1e-12, rng());
    const x = erlangQuantile(u, k, lambda);
    const bin = Math.max(0, Math.min(bins - 1, Math.floor(x / step)));
    counts[bin] = (counts[bin] ?? 0) + 1;
    if (s < shown) {
      shownU.push(u);
      shownX.push(x);
      yield {
        stepNumber: index,
        entities: bars(centers, counts, density, bin, bins, true),
        edges: [],
        description: `Sample ${s + 1}: uniform ${u.toFixed(4)} maps to x=${x.toFixed(4)} in bin ${bin}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { samples: s + 1, u, x, bin, count: counts[bin] ?? 0 },
      };
      index += 1;
    }
  }

  const mean = k / lambda;
  yield {
    stepNumber: index,
    entities: bars(centers, counts, density, -1, bins, true),
    edges: [],
    description: `Finished ${samples} samples; closed-form mean ${mean.toFixed(4)}, median ${erlangQuantile(0.5, k, lambda).toFixed(4)}.`,
    codeLineNumber: 5,
    layout: "array",
    meta: { shape: k, rate: lambda, samples, mean, median: erlangQuantile(0.5, k, lambda), sampleU: shownU, sampleX: shownX, histogram: counts },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "The Erlang distribution models the waiting time until the k-th event of a Poisson process with rate lambda. Its CDF is the finite sum that gives the chance of seeing at least k arrivals by time x, which is also the tail of a Poisson(lambda x) count. Inverting that CDF by bisection gives exact samples.",
    invariants: [
      "The density is nonnegative and integrates to one over the positive real line.",
      "The CDF equals the probability that a Poisson(lambda x) variable is at least k.",
      "Quantile and CDF are inverses: F(Q(u)) equals u for u in (0,1).",
    ],
    correctness:
      "Summing the first k Poisson terms gives the probability of fewer than k arrivals, so one minus that sum is the probability of at least k arrivals, which is exactly the event that the k-th arrival occurs by time x. Differentiating the finite sum recovers the density, and bisection on a continuous increasing CDF returns its mathematical inverse, so inverse-transform samples follow the Erlang law.",
    complexityRationale:
      "One CDF evaluation costs O(k) for the finite sum. Each of the bins costs O(k), and each sample costs O(k log range) for the bisection, giving the stated time bound with O(bins) space for the displayed histogram.",
    uses: [
      "Queueing theory waiting times for k sequential service stages",
      "Telephony traffic and call-center arrival modeling",
      "Reliability models with k sequential failure phases",
    ],
    references: [
      "Erlang, Solution of Some Problems in the Theory of Probabilities of Significance in Automatic Telephone Exchanges, 1917",
      "Ross, Introduction to Probability Models, Chapter 2",
    ],
    workedExample:
      "With shape 3 and rate 1.5, the mean is 3/1.5 = 2. At x = 1 the Poisson mean is 1.5, the sum of terms for j = 0, 1, 2 is about 0.8088, so the CDF is about 0.1912. A uniform draw of 0.5 inverts to roughly 1.67.",
  },
  id: "erlang-distribution",
  name: "Erlang Distribution",
  category: "statistics-probability",
  complexity: { time: "O(bins * k + samples * k log range)", space: "O(bins)" },
  defaultInput: { shape: 3, rate: 1.5, xMax: 5, bins: 16, samples: 300, seed: 7 },
  visualType: "array",
  run,
  pseudocode: [
    "input integer shape k, rate lambda, and bin count",
    "at each bin center x evaluate density lambda^k x^(k-1) exp(-lambda x)/(k-1)!",
    "evaluate CDF 1 - exp(-lambda x) times the sum of (lambda x)^j/j! for j below k",
    "draw uniform u and invert the CDF by bisection",
    "place the sample in the matching histogram bin",
    "report the closed-form mean k/lambda and the median",
  ],
};

export default module;

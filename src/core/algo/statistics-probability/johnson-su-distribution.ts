/**
 * johnson-su-distribution.ts - Johnson SU Distribution
 *
 * The Johnson SU family maps a standard normal z to x through
 * x = xi + sigma * sinh((z - gamma)/delta). Four parameters (shape gamma,
 * shape delta, location xi, scale sigma) produce skewed or symmetric,
 * bounded-moment continuous laws. The CDF is a standard normal CDF evaluated
 * at gamma + delta asinh((x-xi)/sigma), and the quantile inverts that map.
 *
 * Time: O(bins + samples * log range). Space: O(bins).
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

/** Abramowitz and Stegun 7.1.26 approximation to the error function. */
export function erf(x: number): number {
  if (x === 0) return 0;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
    t;
  return sign * (1 - poly * Math.exp(-ax * ax));
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function inverseNormal(p: number): number {
  const target = Math.min(1 - 1e-14, Math.max(1e-14, p));
  let lo = -12;
  let hi = 12;
  for (let i = 0; i < 120; i += 1) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function johnsonSuCdf(
  x: number,
  gamma: number,
  delta: number,
  xi: number,
  sigma: number,
): number {
  const u = (x - xi) / sigma;
  return normalCdf(gamma + delta * Math.asinh(u));
}

export function johnsonSuPdf(
  x: number,
  gamma: number,
  delta: number,
  xi: number,
  sigma: number,
): number {
  const u = (x - xi) / sigma;
  const z = gamma + delta * Math.asinh(u);
  return (delta / (sigma * Math.sqrt(2 * Math.PI) * Math.sqrt(1 + u * u))) * Math.exp((-z * z) / 2);
}

export function johnsonSuQuantile(
  p: number,
  gamma: number,
  delta: number,
  xi: number,
  sigma: number,
): number {
  return xi + sigma * Math.sinh((inverseNormal(p) - gamma) / delta);
}

function bars(
  xs: number[],
  density: number[],
  active: number,
  evaluated: number,
): VisualEntity[] {
  return xs.map((x, i) => {
    let state: EntityState = "unvisited";
    if (i < evaluated) state = "sorted";
    if (i === active) state = "comparing";
    return {
      id: `bar-${i}`,
      type: "bar" as const,
      label: (density[i] ?? 0).toFixed(3),
      value: density[i] ?? 0,
      state,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      metadata: { index: i, x, density: density[i] ?? 0 },
    };
  });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as {
    gamma?: number;
    delta?: number;
    xi?: number;
    sigma?: number;
    xMax?: number;
    bins?: number;
    samples?: number;
    seed?: number;
  } | null) ?? {};
  const gamma = Number.isFinite(Number(task.gamma)) ? Number(task.gamma) : 0;
  const delta = Number(task.delta) > 0 ? Number(task.delta) : 1;
  const xi = Number.isFinite(Number(task.xi)) ? Number(task.xi) : 0;
  const sigma = Number(task.sigma) > 0 ? Number(task.sigma) : 1;
  const xMax = Number(task.xMax) > 0 ? Number(task.xMax) : 6;
  const bins = Math.max(4, Math.min(40, Math.floor(Number(task.bins ?? 16)) || 16));
  const samples = Math.max(1, Math.min(3000, Math.floor(Number(task.samples ?? 200)) || 200));
  const seed = Math.floor(Number(task.seed ?? 23)) || 23;

  const step = (2 * xMax) / bins;
  const xs = Array.from({ length: bins }, (_, i) => -xMax + (i + 0.5) * step);
  const density = xs.map((x) => johnsonSuPdf(x, gamma, delta, xi, sigma));

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(xs, density, -1, 0),
    edges: [],
    description: `Johnson SU density with gamma ${gamma}, delta ${delta}, location ${xi}, scale ${sigma} over ${bins} bins.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { gamma, delta, xi, sigma, bins, xMax },
  };
  index += 1;

  for (let i = 0; i < bins; i += 1) {
    const x = xs[i] as number;
    yield {
      stepNumber: index,
      entities: bars(xs, density, i, i),
      edges: [],
      description: `Bin ${i}: x=${x.toFixed(3)}, density=${johnsonSuPdf(x, gamma, delta, xi, sigma).toFixed(4)}, CDF=${johnsonSuCdf(x, gamma, delta, xi, sigma).toFixed(4)}.`,
      codeLineNumber: 1,
      layout: "array",
      meta: { x, density: johnsonSuPdf(x, gamma, delta, xi, sigma), cdf: johnsonSuCdf(x, gamma, delta, xi, sigma) },
    };
    index += 1;
  }

  const rng = makeRng(seed);
  const shownU: number[] = [];
  const shownX: number[] = [];
  const shown = Math.min(samples, 10);
  for (let s = 0; s < samples; s += 1) {
    const u = Math.max(1e-12, rng());
    const x = johnsonSuQuantile(u, gamma, delta, xi, sigma);
    if (s < shown) {
      shownU.push(u);
      shownX.push(x);
      const nearest = Math.max(0, Math.min(bins - 1, Math.round((x + xMax) / step - 0.5)));
      yield {
        stepNumber: index,
        entities: bars(xs, density, nearest, bins),
        edges: [],
        description: `Sample ${s + 1}: standard normal quantile maps through the sinh transform to x=${x.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { samples: s + 1, u, x },
      };
      index += 1;
    }
  }

  yield {
    stepNumber: index,
    entities: bars(xs, density, -1, bins),
    edges: [],
    description: `Finished ${samples} samples; median ${johnsonSuQuantile(0.5, gamma, delta, xi, sigma).toFixed(4)}.`,
    codeLineNumber: 5,
    layout: "array",
    meta: { gamma, delta, xi, sigma, samples, median: johnsonSuQuantile(0.5, gamma, delta, xi, sigma), sampleU: shownU, sampleX: shownX },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "The Johnson SU family starts with a standard normal variable and stretches it through an inverse hyperbolic sine. That transform can bend a symmetric bell into skewed shapes while keeping the mapping one-to-one. Because the stretch is invertible, a uniform draw can be turned into a normal draw and then pushed through the sinh map to yield an exact sample.",
    invariants: [
      "The transformation from z to x is strictly increasing, so the CDF is well defined.",
      "The CDF is normalCdf(gamma + delta asinh((x-xi)/sigma)).",
      "CDF and quantile are inverses for every probability in (0,1).",
    ],
    correctness:
      "Since sinh and asinh are inverse monotone functions, applying asinh to (x-xi)/sigma and then the normal CDF gives the probability of drawing a value at most x. Inverting solves for the normal quantile and applies sinh, which is the mathematical inverse. The change-of-variables formula multiplies the standard normal density by the derivative of the transform, producing the stated density.",
    complexityRationale:
      "Each bin and each sample needs one asinh or sinh and one error-function evaluation. Inverting the normal CDF by bisection costs a fixed number of iterations, so the run is O(bins + samples log range) in time and O(bins) in space.",
    uses: [
      "Fitting skewed non-normal data in quality control",
      "Modeling asset returns with heavier tails than a normal law",
      "Transforming variables to approximate normality for analysis",
    ],
    references: [
      "Johnson, Systems of Frequency Curves Generated by Methods of Translation, 1949",
      "Abramowitz and Stegun, Handbook of Mathematical Functions, Chapter 26",
    ],
    workedExample:
      "With gamma 0, delta 1, xi 0, sigma 1, the median is 0 because the transform is symmetric. A standard normal draw z = 1 maps to sinh(1), about 1.175. The CDF at 1.175 is normalCdf(1), about 0.8413, and the density there is about 0.186.",
  },
  id: "johnson-su-distribution",
  name: "Johnson SU Distribution",
  category: "statistics-probability",
  complexity: { time: "O(bins + samples log range)", space: "O(bins)" },
  defaultInput: { gamma: 0, delta: 1, xi: 0, sigma: 1, xMax: 6, bins: 16, samples: 200, seed: 23 },
  visualType: "array",
  run,
  pseudocode: [
    "input shape gamma and delta, location xi, scale sigma",
    "at bin center x form u = (x - xi) / sigma",
    "set z = gamma + delta asinh(u) and density = phi(z) delta / (sigma sqrt(1+u^2))",
    "set CDF = Phi(z)",
    "draw uniform u and invert Phi to get a normal draw w",
    "return xi + sigma sinh((w - gamma) / delta)",
    "report the median xi + sigma sinh(-gamma/delta)",
  ],
};

export default module;

/**
 * frechet-distribution.ts - Frechet Distribution (extreme value type II)
 *
 * The Frechet distribution with shape alpha, scale s and location m has CDF
 * exp(-((x-m)/s)^(-alpha)) for x > m. It is the inverse-Weibull law and one of
 * the three limiting laws in extreme value theory. Its quantile inverts in
 * closed form, so seeded uniform draws map exactly to Frechet samples.
 *
 * Time: O(bins + samples). Space: O(bins).
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

export function frechetCdf(x: number, alpha: number, scale: number, location: number): number {
  if (x <= location) return 0;
  return Math.exp(-Math.pow((x - location) / scale, -alpha));
}

export function frechetPdf(x: number, alpha: number, scale: number, location: number): number {
  if (x <= location) return 0;
  const ratio = (x - location) / scale;
  return (alpha / scale) * Math.pow(ratio, -alpha - 1) * Math.exp(-Math.pow(ratio, -alpha));
}

export function frechetQuantile(u: number, alpha: number, scale: number, location: number): number {
  const p = Math.min(1 - 1e-15, Math.max(1e-15, u));
  return location + scale * Math.pow(-Math.log(p), -1 / alpha);
}

function bars(
  centers: number[],
  density: number[],
  counts: number[],
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
      label: showCounts ? String(counts[i] ?? 0) : (density[i] ?? 0).toFixed(3),
      value: showCounts ? (counts[i] ?? 0) : (density[i] ?? 0),
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
    alpha?: number;
    scale?: number;
    location?: number;
    xMax?: number;
    bins?: number;
    samples?: number;
    seed?: number;
  } | null) ?? {};
  const alpha = Number(task.alpha) > 0 ? Number(task.alpha) : 2;
  const scale = Number(task.scale) > 0 ? Number(task.scale) : 1.2;
  const location = Number.isFinite(Number(task.location)) ? Number(task.location) : 0;
  const xMax = Number(task.xMax) > location + 0.01 ? Number(task.xMax) : location + 8 * scale;
  const bins = Math.max(4, Math.min(40, Math.floor(Number(task.bins ?? 16)) || 16));
  const samples = Math.max(1, Math.min(5000, Math.floor(Number(task.samples ?? 300)) || 300));
  const seed = Math.floor(Number(task.seed ?? 11)) || 11;

  const step = (xMax - location) / bins;
  const centers = Array.from({ length: bins }, (_, i) => location + (i + 0.5) * step);
  const density = centers.map((x) => frechetPdf(x, alpha, scale, location));
  const counts = new Array<number>(bins).fill(0);

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(centers, density, counts, -1, 0, false),
    edges: [],
    description: `Frechet density with shape ${alpha}, scale ${scale}, location ${location} over ${bins} bins.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { alpha, scale, location, bins, xMax },
  };
  index += 1;

  for (let i = 0; i < bins; i += 1) {
    const x = centers[i] as number;
    yield {
      stepNumber: index,
      entities: bars(centers, density, counts, i, i, false),
      edges: [],
      description: `Bin ${i}: x=${x.toFixed(3)}, density=${frechetPdf(x, alpha, scale, location).toFixed(4)}, CDF=${frechetCdf(x, alpha, scale, location).toFixed(4)}.`,
      codeLineNumber: 1,
      layout: "array",
      meta: { x, density: frechetPdf(x, alpha, scale, location), cdf: frechetCdf(x, alpha, scale, location) },
    };
    index += 1;
  }

  const rng = makeRng(seed);
  const shownU: number[] = [];
  const shownX: number[] = [];
  const shown = Math.min(samples, 10);
  for (let s = 0; s < samples; s += 1) {
    const u = Math.max(1e-12, rng());
    const x = frechetQuantile(u, alpha, scale, location);
    const bin = Math.max(0, Math.min(bins - 1, Math.floor((x - location) / step)));
    counts[bin] = (counts[bin] ?? 0) + 1;
    if (s < shown) {
      shownU.push(u);
      shownX.push(x);
      yield {
        stepNumber: index,
        entities: bars(centers, density, counts, bin, bins, true),
        edges: [],
        description: `Sample ${s + 1}: uniform ${u.toFixed(4)} maps to x=${x.toFixed(4)} in bin ${bin}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { samples: s + 1, u, x, bin, count: counts[bin] ?? 0 },
      };
      index += 1;
    }
  }

  yield {
    stepNumber: index,
    entities: bars(centers, density, counts, -1, bins, true),
    edges: [],
    description: `Finished ${samples} samples; median ${frechetQuantile(0.5, alpha, scale, location).toFixed(4)} for shape ${alpha}.`,
    codeLineNumber: 5,
    layout: "array",
    meta: { alpha, scale, location, samples, median: frechetQuantile(0.5, alpha, scale, location), sampleU: shownU, sampleX: shownX, histogram: counts },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "The Frechet law describes the maximum of many heavy-tailed observations and is the inverse of the Weibull law: where Weibull decays like exp(-x^k), Frechet decays like exp(-x^-k). Raising a uniform draw to a negative power gives an exact sample, and larger shapes produce a lighter upper tail.",
    invariants: [
      "The density is nonnegative and integrates to one above the location.",
      "The CDF is exp(-((x-m)/s)^(-alpha)) and the quantile is m + s (-ln u)^(-1/alpha).",
      "CDF and quantile are inverses for every u in (0,1).",
    ],
    correctness:
      "The CDF is continuous and strictly increasing on x > m and tends to zero at m and one at infinity, so it is a valid distribution function. Substituting the quantile into the CDF collapses the exponent to -ln u, giving exp(ln u) = u, which proves the inverse-transform samples have the Frechet distribution. Differentiating the CDF recovers the density.",
    complexityRationale:
      "Each of the bins needs one exponentiation and each sample one logarithm and one power, so the run costs O(bins + samples) time and O(bins) space for the histogram.",
    uses: [
      "Modeling annual maximum rainfall and flood levels",
      "Extreme losses in insurance and financial risk",
      "Largest wind gust or wave height in engineering design",
    ],
    references: [
      "Frechet, Sur la loi de probabilite de l'ecart maximum, 1927",
      "Coles, An Introduction to Statistical Modeling of Extreme Values, Chapter 3",
    ],
    workedExample:
      "With alpha 2, scale 1.2, location 0 and u = 0.5, the quantile is 1.2 times (ln 2)^(-1/2), about 1.436. The CDF at 1.436 returns 0.5. The density is zero at and below the location and rises to a mode before decaying with a heavy tail.",
  },
  id: "frechet-distribution",
  name: "Frechet Distribution",
  category: "statistics-probability",
  complexity: { time: "O(bins + samples)", space: "O(bins)" },
  defaultInput: { alpha: 2, scale: 1.2, location: 0, xMax: 10, bins: 16, samples: 300, seed: 11 },
  visualType: "array",
  run,
  pseudocode: [
    "input shape alpha, scale s, and location m",
    "for each bin center x above m compute density (alpha/s) r^(-alpha-1) exp(-r^(-alpha))",
    "where r is (x-m)/s, and CDF exp(-r^(-alpha))",
    "draw uniform u and return m + s (-ln u)^(-1/alpha)",
    "place the sample in the matching histogram bin",
    "report the closed-form median m + s (ln 2)^(-1/alpha)",
  ],
};

export default module;

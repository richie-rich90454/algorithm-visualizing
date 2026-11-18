/**
 * weibull-distribution.ts - Weibull Distribution (density, CDF, inverse transform)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Weibull distribution with shape k and scale lambda has density
 * (k/lambda) (x/lambda)^(k-1) exp(-(x/lambda)^k) on x >= 0 and CDF
 * 1 - exp(-(x/lambda)^k). Its quantile function is lambda (-ln(1-u))^(1/k),
 * which makes exact sampling by inverse transform possible. The demo draws the
 * density as bars, evaluates the CDF at each bar, then draws seeded samples
 * and shows an empirical histogram that converges to the density.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(bins + samples) per run
 *   Space: O(bins) for the histogram
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the theoretical density at equally spaced x values.
 *   - The bar under evaluation is BLUE (comparing); evaluated bars are GREEN.
 *   - A sample lights its bin ORANGE (active) and increments its label.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic mulberry32 generator so every replay is identical. */
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as {
    shape?: number;
    scale?: number;
    xMax?: number;
    bins?: number;
    samples?: number;
    seed?: number;
  } | null) ?? {};
  const shape = typeof task.shape === "number" && task.shape > 0 ? task.shape : 2;
  const scale = typeof task.scale === "number" && task.scale > 0 ? task.scale : 1.5;
  const xMax = typeof task.xMax === "number" && task.xMax > 0 ? task.xMax : 5 * scale;
  const bins = typeof task.bins === "number" ? Math.max(4, Math.min(40, task.bins | 0)) : 16;
  const samples = typeof task.samples === "number" ? Math.max(1, Math.min(2000, task.samples | 0)) : 300;
  const seed = typeof task.seed === "number" ? task.seed : 42;

  const step = xMax / bins;
  const centers = Array.from({ length: bins }, (_, i) => (i + 0.5) * step);
  const pdf = (x: number): number => {
    if (x <= 0) return shape === 1 ? 1 / scale : 0;
    const t = x / scale;
    return (shape / scale) * Math.pow(t, shape - 1) * Math.exp(-Math.pow(t, shape));
  };
  const cdf = (x: number): number => (x <= 0 ? 0 : 1 - Math.exp(-Math.pow(x / scale, shape)));
  const quantile = (u: number): number => scale * Math.pow(-Math.log(1 - u), 1 / shape);
  const counts = new Array<number>(bins).fill(0);

  const makeBars = (active: number, evaluated: number, showCounts: boolean): VisualEntity[] =>
    centers.map((x, i) => {
      let state: EntityState = "unvisited";
      if (i < evaluated) state = "sorted";
      if (i === active) state = showCounts ? "active" : "comparing";
      return {
        id: `bin-${i}`,
        type: "bar" as const,
        label: showCounts ? String(counts[i] ?? 0) : pdf(x).toFixed(3),
        value: showCounts ? (counts[i] ?? 0) : pdf(x),
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i, x, density: pdf(x) },
      };
    });

  let index = 0;
  yield {
    stepNumber: index,
    entities: makeBars(-1, 0, false),
    edges: [],
    description: `Weibull density with shape ${shape} and scale ${scale} over ${bins} bins from 0 to ${xMax.toFixed(2)}.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { shape, scale, bins, xMax },
  };
  index += 1;

  for (let i = 0; i < bins; i += 1) {
    const x = centers[i] as number;
    yield {
      stepNumber: index,
      entities: makeBars(i, i, false),
      edges: [],
      description: `Bin ${i}: x=${x.toFixed(3)}, density=${pdf(x).toFixed(4)}, CDF=${cdf(x).toFixed(4)}.`,
      codeLineNumber: 1,
      layout: "array",
      meta: { shape, scale, evaluated: i + 1, x, density: pdf(x), cdf: cdf(x) },
    };
    index += 1;
  }

  const rng = makeRng(seed);
  const drawnU: number[] = [];
  const drawnX: number[] = [];
  const shown = Math.min(samples, 12);
  for (let s = 0; s < samples; s += 1) {
    const u = Math.max(1e-12, rng());
    const x = quantile(u);
    const bin = Math.max(0, Math.min(bins - 1, Math.floor(x / step)));
    counts[bin] = (counts[bin] ?? 0) + 1;
    if (s < shown) {
      drawnU.push(u);
      drawnX.push(x);
      yield {
        stepNumber: index,
        entities: makeBars(bin, bins, true),
        edges: [],
        description: `Sample ${s + 1}: u=${u.toFixed(4)} maps to x=${x.toFixed(4)} in bin ${bin}; bin count is now ${counts[bin]}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { samples: s + 1, u, x, bin, count: counts[bin] ?? 0 },
      };
      index += 1;
    }
  }

  // Integrate x*f(x) with a fine trapezoid grid as an independent mean estimate.
  const slices = 20000;
  let weighted = 0;
  for (let i = 0; i <= slices; i += 1) {
    const x = (i / slices) * xMax;
    const w = i === 0 || i === slices ? 0.5 : 1;
    weighted += w * x * pdf(x);
  }
  const mean = (weighted * xMax) / slices;
  const median = quantile(0.5);

  yield {
    stepNumber: index,
    entities: makeBars(-1, bins, true),
    edges: [],
    description: `Finished ${samples} samples; empirical mean ${(drawnX.reduce((a, b) => a + b, 0) / drawnX.length).toFixed(4)} versus integrated mean ${mean.toFixed(4)}.`,
    codeLineNumber: 5,
    layout: "array",
    meta: {
      shape,
      scale,
      samples,
      mean,
      median,
      sampleU: drawnU,
      sampleX: drawnX,
      histogram: counts,
    },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "A Weibull variable is a stretched exponential: raising x/scale to the shape power inside an exponential bends the familiar decay curve. A small shape gives a heavy tail near zero, shape one is exactly the exponential distribution, and a large shape concentrates values near the scale. Because the CDF inverts in closed form, drawing a uniform u and returning scale times negative log of one minus u to the one-over-shape gives an exact sample.",
    invariants: [
      "The density is nonnegative and integrates to one over the positive real line.",
      "The CDF equals one minus the exponential of negative (x/scale) raised to the shape.",
      "Quantile and CDF are inverses: F(Q(u)) equals u for every u in (0,1).",
    ],
    correctness:
      "Differentiating the CDF recovers the density because d/dx of one minus exp(-(x/lambda)^k) is (k/lambda)(x/lambda)^(k-1) exp(-(x/lambda)^k). Since the CDF is continuous and strictly increasing, applying its inverse to a uniform draw produces a variable whose CDF is exactly the target, so the inverse-transform samples follow the Weibull law.",
    complexityRationale:
      "Evaluating density and CDF at each of the bins costs constant time, and each of the samples costs one logarithm and one power, so the run is O(bins + samples) time and O(bins) space for the empirical histogram.",
    uses: [
      "Reliability engineering and time-to-failure modeling",
      "Wind speed distribution for energy yield estimates",
      "Survival analysis with increasing or decreasing hazard rates",
    ],
    references: [
      "Weibull, A Statistical Distribution Function of Wide Applicability, 1951",
      "Lawless, Statistical Models and Methods for Lifetime Data, 2nd edition",
    ],
    workedExample:
      "With shape 2, scale 1.5 and u=0.5, the quantile is 1.5 times the log of two to the one-half power, about 1.249. The CDF at that point returns 0.5. The density peaks near x=1.06 and the mean, computed by integrating x times the density, is about 1.329.",
  },
  id: "weibull-distribution",
  name: "Weibull Distribution",
  category: "statistics-probability",
  complexity: { time: "O(bins + samples)", space: "O(bins)" },
  defaultInput: { shape: 2, scale: 1.5, xMax: 7.5, bins: 16, samples: 300, seed: 42 },
  visualType: "array",
  run,
  pseudocode: [
    "input shape k, scale lambda, and bin count",
    "for each bin center x compute density k/lambda (x/lambda)^(k-1) exp(-(x/lambda)^k)",
    "also compute CDF 1 - exp(-(x/lambda)^k) at that x",
    "draw uniform u and return lambda (-ln(1-u))^(1/k)",
    "place the sample in the matching histogram bin",
    "integrate x times density for the mean, then report the median",
  ],
};

export default module;

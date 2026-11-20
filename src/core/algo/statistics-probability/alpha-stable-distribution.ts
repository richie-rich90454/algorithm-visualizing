/**
 * alpha-stable-distribution.ts - Symmetric Alpha-Stable Distribution
 *
 * A symmetric alpha-stable law with stability parameter alpha in (0,2] and
 * scale sigma has characteristic function exp(-(sigma |t|)^alpha). Except for
 * alpha = 2 (Gaussian) and alpha = 1 (Cauchy) its density has no elementary
 * closed form, so it is recovered by numerically inverting the characteristic
 * function with the cosine transform f(x) = (1/pi) integral of exp(-(sigma
 * t)^alpha) cos(t x) dt from zero to infinity. Smaller alpha gives heavier
 * tails.
 *
 * Time: O(bins * grid). Space: O(bins).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Characteristic function of the symmetric alpha-stable law. */
export function stableCharacteristic(t: number, alpha: number, sigma: number): number {
  return Math.exp(-Math.pow(sigma * Math.abs(t), alpha));
}

/** Density by numerical inversion of the characteristic function. */
export function stablePdf(x: number, alpha: number, sigma: number): number {
  const upper = Math.max(60, 20 / Math.pow(sigma, 1 / alpha));
  const n = 4000;
  const h = upper / n;
  let sum = stableCharacteristic(0, alpha, sigma) + stableCharacteristic(upper, alpha, sigma) * Math.cos(upper * x);
  for (let i = 1; i < n; i += 1) {
    const t = i * h;
    const weight = i % 2 === 0 ? 2 : 4;
    sum += weight * stableCharacteristic(t, alpha, sigma) * Math.cos(t * x);
  }
  return (h * sum) / (3 * Math.PI);
}

function bars(xs: number[], density: number[], active: number, evaluated: number): VisualEntity[] {
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
  const task = (input as { alpha?: number; sigma?: number; xMax?: number; bins?: number } | null) ?? {};
  const alpha = Math.max(0.4, Math.min(2, Number(task.alpha) > 0 ? Number(task.alpha) : 1.5));
  const sigma = Number(task.sigma) > 0 ? Number(task.sigma) : 1;
  const xMax = Number(task.xMax) > 0 ? Number(task.xMax) : 6;
  const bins = Math.max(6, Math.min(60, Math.floor(Number(task.bins ?? 32)) || 32));

  const step = (2 * xMax) / bins;
  const xs = Array.from({ length: bins }, (_, i) => -xMax + (i + 0.5) * step);
  const density = xs.map((x) => stablePdf(x, alpha, sigma));

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(xs, density, -1, 0),
    edges: [],
    description: `Symmetric alpha-stable density with alpha ${alpha} and scale ${sigma} over ${bins} bins on -${xMax} to ${xMax}.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { alpha, sigma, bins, xMax },
  };
  index += 1;

  for (let i = 0; i < bins; i += 1) {
    const x = xs[i] as number;
    yield {
      stepNumber: index,
      entities: bars(xs, density, i, i),
      edges: [],
      description: `Bin ${i}: x=${x.toFixed(3)}, density=${stablePdf(x, alpha, sigma).toFixed(4)}, characteristic function at x=${stableCharacteristic(x, alpha, sigma).toFixed(4)}.`,
      codeLineNumber: 1,
      layout: "array",
      meta: { x, density: stablePdf(x, alpha, sigma), cf: stableCharacteristic(x, alpha, sigma) },
    };
    index += 1;
  }

  const center = stablePdf(0, alpha, sigma);
  const atOne = stablePdf(1, alpha, sigma);
  yield {
    stepNumber: index,
    entities: bars(xs, density, -1, bins),
    edges: [],
    description: `Finished: density at zero ${center.toFixed(4)}, at one ${atOne.toFixed(4)}; tail heaviness grows as alpha falls.`,
    codeLineNumber: 3,
    layout: "array",
    meta: { alpha, sigma, center, atOne, tailRatio: atOne / center },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Alpha-stable laws generalize the bell curve by letting the tails decay as a power law instead of an exponential. The single parameter alpha controls tail weight: two recovers the normal distribution, one gives the Cauchy distribution, and values between them produce heavier tails. Most stable densities have no simple formula, so the characteristic function is inverted numerically with a cosine integral.",
    invariants: [
      "The characteristic function is exp(-(sigma |t|)^alpha) and equals one at t = 0.",
      "The density is symmetric about zero and nonnegative.",
      "For alpha = 2 the law is normal with variance 2 sigma squared; for alpha = 1 it is Cauchy with scale sigma.",
    ],
    correctness:
      "By the inversion theorem for characteristic functions, a symmetric law with characteristic function phi has density (1/2pi) integral of phi(t) exp(-i x t) dt over the real line. Because phi is even and real for a symmetric stable law, the imaginary part cancels and the integral reduces to (1/pi) times the cosine transform, which is evaluated by Simpson's rule. The special cases follow by substituting alpha = 2, giving a Gaussian transform, and alpha = 1, giving the Cauchy transform.",
    complexityRationale:
      "The cosine integral uses a fixed grid of points for each bin, so evaluating all bins costs O(bins * grid) time and O(bins) space for the displayed bars.",
    uses: [
      "Modeling heavy-tailed financial returns and market shocks",
      "Describing noise in radar and telecommunications with impulsive spikes",
      "Modeling spatial distributions in cosmology and physics",
    ],
    references: [
      "Samorodnitsky and Taqqu, Stable Non-Gaussian Random Processes, Chapter 1",
      "Nolan, Stable Distributions: Models for Heavy Tailed Data, 2020",
    ],
    workedExample:
      "With alpha = 2 and sigma = 1, the cosine integral of exp(-t^2) gives density 1/(2 sqrt(pi)) exp(-x^2/4) at zero, about 0.2821, which is the normal N(0,2) density. With alpha = 1 the density at zero is 1/pi, about 0.3183, the Cauchy density.",
  },
  id: "alpha-stable-distribution",
  name: "Alpha-Stable Distribution",
  category: "statistics-probability",
  complexity: { time: "O(bins * grid)", space: "O(bins)" },
  defaultInput: { alpha: 1.5, sigma: 1, xMax: 6, bins: 32 },
  visualType: "array",
  run,
  pseudocode: [
    "input stability alpha, scale sigma, and bin count",
    "define characteristic function phi(t) = exp(-(sigma |t|)^alpha)",
    "for each x evaluate f(x) = (1/pi) integral phi(t) cos(x t) dt",
    "compute the integral numerically with Simpson's rule on a fine grid",
    "plot the density bar at x and note the tail heaviness",
    "done: report density at zero and the tail ratio",
  ],
};

export default module;

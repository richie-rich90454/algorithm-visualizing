/**
 * stratified-sampling.ts - Stratified Monte Carlo Sampling
 *
 * Stratified sampling partitions the unit interval into equal strata and draws
 * one sample from each rather than drawing all samples at once. This spreads
 * points evenly and reduces the variance of an integral estimate whenever the
 * integrand is roughly monotone. For the linear integrand f(x) = x the estimate
 * has the exact expectation one half.
 *
 * Time: O(strata). Space: O(strata).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

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

/** One seeded uniform draw inside each stratum. */
export function stratifiedUniforms(strata: number, seed: number): number[] {
  const random = mulberry32(seed);
  return Array.from({ length: strata }, (_, i) => (i + random()) / strata);
}

export interface StratifiedResult {
  samples: number[];
  estimate: number;
  strata: number;
}

/** Estimate the mean of f on [0,1] with one draw per stratum. */
export function stratifiedEstimate(
  strata: number,
  seed: number,
  f: (x: number) => number = (x) => x,
): StratifiedResult {
  const samples = stratifiedUniforms(strata, seed);
  const estimate = samples.reduce((sum, x) => sum + f(x), 0) / strata;
  return { samples, estimate, strata };
}

/** Plain Monte Carlo estimate on the same number of draws for comparison. */
export function simpleMcEstimate(strata: number, seed: number, f: (x: number) => number = (x) => x): number {
  const random = mulberry32(seed);
  let sum = 0;
  for (let i = 0; i < strata; i += 1) sum += f(random());
  return sum / strata;
}

function bars(samples: number[], active: number): VisualEntity[] {
  return samples.map((x, i) => ({
    id: `stratum-${i}`,
    type: "bar" as const,
    label: `s${i}: ${x.toFixed(3)}`,
    value: x,
    state: (i === active ? "comparing" : i < active ? "sorted" : "unvisited") as EntityState,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    metadata: { stratum: i, value: x },
  }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { strata?: number; seed?: number } | null) ?? {};
  const strata = Math.max(2, Math.min(100, Math.floor(Number(task.strata ?? 20)) || 20));
  const seed = Math.floor(Number(task.seed ?? 9)) || 9;
  const result = stratifiedEstimate(strata, seed);
  const simple = simpleMcEstimate(strata, seed);

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(result.samples, -1),
    edges: [],
    description: `Stratified sampling of f(x)=x with ${strata} equal strata and seed ${seed}.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { strata, seed },
  };
  index += 1;

  const shown = Math.min(strata, 12);
  let running = 0;
  for (let i = 0; i < shown; i += 1) {
    running += result.samples[i] as number;
    yield {
      stepNumber: index,
      entities: bars(result.samples, i),
      edges: [],
      description: `Stratum ${i}: sample ${(result.samples[i] as number).toFixed(4)}, running mean ${(running / (i + 1)).toFixed(4)}.`,
      codeLineNumber: 2,
      layout: "array",
      meta: { stratum: i, sample: result.samples[i] as number, runningMean: running / (i + 1) },
    };
    index += 1;
  }

  yield {
    stepNumber: index,
    entities: bars(result.samples, strata - 1),
    edges: [],
    description: `Stratified estimate ${result.estimate.toFixed(5)} versus plain Monte Carlo ${simple.toFixed(5)}; true value 0.5.`,
    codeLineNumber: 4,
    layout: "array",
    meta: { estimate: result.estimate, simple, trueValue: 0.5, samples: result.samples, done: true },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Instead of throwing darts at random across the whole interval, stratified sampling divides it into equal bins and places exactly one dart in each. The samples can no longer clump together or leave large gaps, so the average of the sampled values is much closer to the true integral. The benefit grows when the function being integrated changes smoothly across the interval.",
    invariants: [
      "Every stratum contributes exactly one sample in its own subinterval.",
      "The samples are deterministic for a fixed seed.",
      "For f(x) = x the expected stratified estimate is exactly one half.",
    ],
    correctness:
      "Each stratum sample is uniform on [i/L, (i+1)/L], so its expectation is the stratum midpoint (i + 0.5)/L. Averaging those midpoints gives L(L-1)/2 + L/2 over L squared, which simplifies to one half, the true integral of x on [0,1]. Because each stratum is sampled independently, the variance of the mean is the sum of within-stratum variances divided by L squared, which is smaller than plain Monte Carlo whenever between-stratum variation is substantial.",
    complexityRationale:
      "Drawing one uniform per stratum and averaging costs O(L) time and O(L) space for the displayed samples.",
    uses: [
      "Numerical integration in rendering and physics engines",
      "Variance reduction in Monte Carlo finance simulations",
      "Sampling pixels for anti-aliasing in computer graphics",
    ],
    references: [
      "Hammersley and Handscomb, Monte Carlo Methods, Chapter 5",
      "Owen, Monte Carlo Theory, Methods and Examples, Chapter 8",
    ],
    workedExample:
      "With four strata and uniforms 0.1, 0.4, 0.6 and 0.9, the samples are 0.025, 0.35, 0.65 and 0.975. Their average is 0.5 exactly. A plain Monte Carlo draw with the same seed might land several values on one side and give an estimate farther from 0.5.",
  },
  id: "stratified-sampling",
  name: "Stratified Sampling",
  category: "statistics-probability",
  complexity: { time: "O(strata)", space: "O(strata)" },
  defaultInput: { strata: 20, seed: 9 },
  visualType: "array",
  run,
  pseudocode: [
    "input the number of strata and a random seed",
    "for each stratum i draw a uniform u and set x = (i + u) / strata",
    "evaluate the integrand f(x) at that sample",
    "average all sampled values to estimate the integral",
    "compute a plain Monte Carlo estimate for comparison",
    "report both estimates against the known true value",
  ],
};

export default module;

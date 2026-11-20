/**
 * nested-sampling.ts - Nested Sampling Evidence Accumulation
 *
 * Nested sampling estimates the Bayesian evidence by replacing the prior
 * volume with a shrinking sequence of ellipsoidal or quantile contours. Live
 * points are ordered by likelihood; each removed point contracts the enclosed
 * prior volume by a predictable factor. The evidence is the sum over points of
 * the volume removed times the likelihood at that contour.
 *
 * Time: O(n log n) to sort points plus O(n) accumulation. Space: O(n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface NestedResult {
  z: number;
  logZ: number;
  contributions: number[];
  volumes: number[];
}

/** Sum volume-shrinkage times likelihood to estimate the evidence. */
export function nestedEvidence(logLikelihoods: number[], volumes?: number[]): NestedResult {
  const n = logLikelihoods.length;
  const xs = volumes && volumes.length === n + 1
    ? volumes
    : Array.from({ length: n + 1 }, (_, i) => Math.exp(-i / Math.max(1, n)));
  const contributions: number[] = [];
  let z = 0;
  for (let i = 0; i < n; i += 1) {
    const delta = Math.max(0, (xs[i] as number) - (xs[i + 1] as number));
    const likelihood = Math.exp(logLikelihoods[i] as number);
    const contribution = delta * likelihood;
    contributions.push(contribution);
    z += contribution;
  }
  return { z, logZ: Math.log(Math.max(1e-300, z)), contributions, volumes: xs };
}

function bars(values: number[], active: number): VisualEntity[] {
  return values.map((value, i) => ({
    id: `point-${i}`,
    type: "bar" as const,
    label: `point ${i}: ${value.toFixed(4)}`,
    value,
    state: (i === active ? "comparing" : i < active ? "sorted" : "unvisited") as EntityState,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    metadata: { index: i, contribution: value },
  }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { samples?: number; seed?: number; volumes?: number[] } | null) ?? {};
  const samples = Math.max(4, Math.min(400, Math.floor(Number(task.samples ?? 24)) || 24));
  const seed = Math.floor(Number(task.seed ?? 3)) || 3;

  let state = seed >>> 0;
  const random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const logLikelihoods = Array.from({ length: samples }, (_, i) =>
    Math.log(Math.max(1e-6, (i + 1) / samples)) - 0.5 + 0.2 * random(),
  ).sort((a, b) => a - b);
  const result = nestedEvidence(logLikelihoods, task.volumes);

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(result.contributions, -1),
    edges: [],
    description: `Nested sampling with ${samples} ordered live points accumulating the evidence integral.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { samples, seed },
  };
  index += 1;

  const shown = Math.min(samples, 12);
  let running = 0;
  for (let i = 0; i < shown; i += 1) {
    running += result.contributions[i] as number;
    yield {
      stepNumber: index,
      entities: bars(result.contributions, i),
      edges: [],
      description: `Point ${i}: log likelihood ${(logLikelihoods[i] as number).toFixed(3)}, volume ${(result.volumes[i] as number).toFixed(4)}, running evidence ${running.toFixed(5)}.`,
      codeLineNumber: 2,
      layout: "array",
      meta: { index: i, logLikelihood: logLikelihoods[i] as number, volume: result.volumes[i] as number, runningZ: running },
    };
    index += 1;
  }

  yield {
    stepNumber: index,
    entities: bars(result.contributions, samples - 1),
    edges: [],
    description: `Estimated evidence Z=${result.z.toFixed(5)}, log Z=${result.logZ.toFixed(4)}.`,
    codeLineNumber: 4,
    layout: "array",
    meta: { z: result.z, logZ: result.logZ, contributions: result.contributions, done: true },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Nested sampling replaces the intractable evidence integral over parameter space with a one-dimensional integral over enclosed prior volume. Live points are sorted by likelihood; each time the worst point is replaced, the surviving volume shrinks by a predictable factor. Multiplying each volume decrement by the likelihood at that contour and summing gives the evidence directly, while also producing posterior samples as a by-product.",
    invariants: [
      "Prior volumes decrease monotonically from one toward zero.",
      "Each contribution is a nonnegative volume decrement times a likelihood.",
      "The evidence estimate equals the sum of all contour contributions.",
    ],
    correctness:
      "Writing the evidence as an integral of likelihood over prior mass and partitioning the mass by the live-point contours turns it into a Riemann sum. As the number of live points grows, the maximum volume decrement shrinks and the sum converges to the evidence integral. Sorting points by likelihood ensures the enclosing volumes are nested, which is exactly the partition required by the change of variables.",
    complexityRationale:
      "Sorting the live points costs O(n log n) and the contour summation costs O(n), giving O(n log n) time and O(n) space for the stored contributions.",
    uses: [
      "Bayesian evidence computation for model selection",
      "MultiNEST and PolyChord nested sampling implementations",
      "Posterior sample generation in astronomy and cosmology",
    ],
    references: [
      "Skilling, Nested Sampling for General Bayesian Computation, 2006",
      "Feroz, Hobson and Bridges, MultiNEST, 2009",
    ],
    workedExample:
      "With a uniform prior on zero to one and likelihood L(x) = x, the true evidence is one half. Using contours at volumes X_i = 1 - i/N with likelihood i/N, each rectangle contributes (1/N)(i/N), and the sum approaches (N-1)/(2N), which tends to 0.5 as N grows.",
  },
  id: "nested-sampling",
  name: "Nested Sampling",
  category: "statistics-probability",
  complexity: { time: "O(n log n)", space: "O(n)" },
  defaultInput: { samples: 24, seed: 3 },
  visualType: "array",
  run,
  pseudocode: [
    "input ordered likelihoods of the live points and their prior volumes",
    "for each contour compute the volume removed since the previous contour",
    "multiply that volume decrement by the likelihood at the contour",
    "add the product to the running evidence estimate",
    "record each contribution for the diagnostic bars",
    "take the logarithm of the total to obtain log evidence",
    "done: report Z and log Z",
  ],
};

export default module;

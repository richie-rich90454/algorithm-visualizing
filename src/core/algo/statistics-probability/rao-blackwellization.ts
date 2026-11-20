/**
 * rao-blackwellization.ts - Rao-Blackwell Variance Reduction
 *
 * Rao-Blackwellization replaces an unbiased estimator by its expectation
 * conditional on a sufficient statistic. The new estimator stays unbiased but
 * has variance no larger. For n draws from N(mu, 1), the single observation X1
 * is unbiased with variance 1; conditioning on the sample mean gives the
 * sample mean itself, which is unbiased with variance 1/n.
 *
 * Time: O(replications * n). Space: O(replications).
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

/** Seeded standard normal draws using the Box-Muller transform. */
export function normalSample(n: number, seed: number, mu = 0): number[] {
  const random = mulberry32(seed);
  const result: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const u1 = Math.max(1e-12, random());
    const u2 = random();
    result.push(mu + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
  }
  return result;
}

export interface BlackwellPair {
  crude: number;
  sufficient: number;
  conditional: number;
}

/** Replace X1 by its conditional expectation given the sample mean. */
export function raoBlackwellize(samples: number[]): BlackwellPair {
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return { crude: samples[0] as number, sufficient: mean, conditional: mean };
}

export interface VarianceComparison {
  crude: number[];
  conditional: number[];
  crudeVariance: number;
  conditionalVariance: number;
}

/** Compare the two estimators across independent replications. */
export function compareEstimators(
  replications: number,
  sampleSize: number,
  seed: number,
  mu = 0,
): VarianceComparison {
  const crude: number[] = [];
  const conditional: number[] = [];
  for (let rep = 0; rep < replications; rep += 1) {
    const pair = raoBlackwellize(normalSample(sampleSize, seed + rep * 7919, mu));
    crude.push(pair.crude);
    conditional.push(pair.conditional);
  }
  const variance = (values: number[]): number => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  };
  return {
    crude,
    conditional,
    crudeVariance: variance(crude),
    conditionalVariance: variance(conditional),
  };
}

function bars(pairs: BlackwellPair[], active: number): VisualEntity[] {
  return pairs.map((pair, i) => ({
    id: `rep-${i}`,
    type: "bar" as const,
    label: `rep ${i}: RB ${pair.conditional.toFixed(2)}`,
    value: pair.conditional,
    state: (i === active ? "comparing" : i < active ? "sorted" : "unvisited") as EntityState,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    metadata: { replication: i, crude: pair.crude, conditional: pair.conditional },
  }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { replications?: number; sampleSize?: number; seed?: number; mu?: number } | null) ?? {};
  const replications = Math.max(4, Math.min(400, Math.floor(Number(task.replications ?? 60)) || 60));
  const sampleSize = Math.max(2, Math.min(200, Math.floor(Number(task.sampleSize ?? 12)) || 12));
  const seed = Math.floor(Number(task.seed ?? 4)) || 4;
  const mu = Number.isFinite(Number(task.mu)) ? Number(task.mu) : 0;

  const pairs: BlackwellPair[] = [];
  for (let rep = 0; rep < replications; rep += 1) {
    pairs.push(raoBlackwellize(normalSample(sampleSize, seed + rep * 7919, mu)));
  }
  const comparison = compareEstimators(replications, sampleSize, seed, mu);

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(pairs, -1),
    edges: [],
    description: `Rao-Blackwellization over ${replications} replications of ${sampleSize} normal draws each.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { replications, sampleSize, seed, mu },
  };
  index += 1;

  const shown = Math.min(replications, 12);
  for (let i = 0; i < shown; i += 1) {
    const pair = pairs[i] as BlackwellPair;
    yield {
      stepNumber: index,
      entities: bars(pairs, i),
      edges: [],
      description: `Replication ${i}: crude X1 ${pair.crude.toFixed(3)}, Rao-Blackwellized mean ${pair.conditional.toFixed(3)}.`,
      codeLineNumber: 2,
      layout: "array",
      meta: { replication: i, crude: pair.crude, conditional: pair.conditional },
    };
    index += 1;
  }

  yield {
    stepNumber: index,
    entities: bars(pairs, replications - 1),
    edges: [],
    description: `Variance fell from ${comparison.crudeVariance.toFixed(4)} to ${comparison.conditionalVariance.toFixed(4)}, near the target 1/${sampleSize}.`,
    codeLineNumber: 4,
    layout: "array",
    meta: {
      crudeVariance: comparison.crudeVariance,
      conditionalVariance: comparison.conditionalVariance,
      targetVariance: 1 / sampleSize,
      done: true,
    },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "If an estimator ignores useful information, conditioning it on a sufficient statistic often sharpens it for free. Rao-Blackwellization replaces a noisy estimate by the average of all estimates consistent with the sufficient statistic. The result cannot be more biased and never has higher variance, because the leftover randomness is averaged away.",
    invariants: [
      "The conditional estimator is a deterministic function of the sufficient statistic.",
      "Both estimators have the same expectation mu.",
      "The conditional variance never exceeds the crude variance.",
    ],
    correctness:
      "By the law of total expectation, E[E[X1 | T]] equals E[X1], so unbiasedness is preserved. By the law of total variance, Var(X1) equals E[Var(X1 | T)] plus Var(E[X1 | T]), so the conditional estimator removes the nonnegative component E[Var(X1 | T)]. For a normal sample the mean is sufficient and E[X1 | sample mean] equals the sample mean, whose variance is 1/n.",
    complexityRationale:
      "Generating and averaging each replication costs O(n); over all replications that is O(replications * n) time and O(replications) space for the stored estimates.",
    uses: [
      "Variance reduction in Monte Carlo simulation",
      "Deriving minimum-variance unbiased estimators in statistics",
      "Particle filtering and latent-variable model inference",
    ],
    references: [
      "Rao, Information and the Accuracy Attainable in the Estimation of Statistical Parameters, 1945",
      "Blackwell, Conditional Expectation and Unbiased Sequential Estimation, 1947",
    ],
    workedExample:
      "With twelve standard normal draws, using only the first draw gives an estimate with variance about one. Conditioning on the sample mean replaces that single draw by the mean of all twelve, which is still centered at zero but has variance about 1/12. The conditional estimator is the sample mean itself.",
  },
  id: "rao-blackwellization",
  name: "Rao-Blackwellization",
  category: "statistics-probability",
  complexity: { time: "O(replications * n)", space: "O(replications)" },
  defaultInput: { replications: 60, sampleSize: 12, seed: 4, mu: 0 },
  visualType: "array",
  run,
  pseudocode: [
    "input replication count, sample size, and target mean",
    "for each replication draw n normal observations with a seeded generator",
    "form the crude estimator X1 and the sufficient statistic sample mean",
    "replace X1 by its conditional expectation given the sample mean",
    "repeat across replications and record both estimator sequences",
    "compare the empirical variances with the theoretical 1/n",
    "done: report the variance reduction",
  ],
};

export default module;

/**
 * rejection-sampling.ts - Rejection Sampling from a Power-Law Density
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * To sample from a density that is hard to invert, draw a candidate x from an
 * easy proposal distribution and keep it only with probability f(x)/(M g(x)),
 * where M bounds f/g everywhere. Here the target is f(x) = (p+1)x^p on [0,1],
 * the proposal is uniform on [0,1], and the tight envelope is M = p+1, so a
 * candidate is accepted when a second uniform draw is at most x^p. Accepted
 * points follow the target exactly; rejected points are discarded.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(trials), about M trials per accepted sample in expectation
 *   Space: O(bins) for the acceptance histogram
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the target density across equal bins of [0,1].
 *   - A candidate's bin turns GREEN on acceptance and RED on rejection.
 *   - Bar labels count accepted samples that landed in each bin.
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as {
    exponent?: number;
    samples?: number;
    bins?: number;
    seed?: number;
    maxTrials?: number;
  } | null) ?? {};
  const exponent = typeof task.exponent === "number" && task.exponent >= 0 ? task.exponent : 1;
  const wanted = typeof task.samples === "number" ? Math.max(1, Math.min(5000, task.samples | 0)) : 400;
  const bins = typeof task.bins === "number" ? Math.max(4, Math.min(40, task.bins | 0)) : 12;
  const seed = typeof task.seed === "number" ? task.seed : 7;
  const maxTrials = typeof task.maxTrials === "number" ? task.maxTrials : 100000;

  const envelope = exponent + 1;
  const density = (x: number): number => envelope * Math.pow(x, exponent);
  const counts = new Array<number>(bins).fill(0);
  const centers = Array.from({ length: bins }, (_, i) => (i + 0.5) / bins);

  const makeBars = (active: number, state: EntityState): VisualEntity[] =>
    centers.map((x, i) => ({
      id: `bin-${i}`,
      type: "bar" as const,
      label: String(counts[i] ?? 0),
      value: counts[i] ?? 0,
      state: i === active ? state : "unvisited",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      metadata: { row: 0, col: i, target: density(x) },
    }));

  let index = 0;
  yield {
    stepNumber: index,
    entities: makeBars(-1, "idle"),
    edges: [],
    description: `Target density (p+1)x^p with p=${exponent}, uniform proposal, envelope M=${envelope}, ${bins} bins.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { exponent, envelope, bins, wanted },
  };
  index += 1;

  const rng = makeRng(seed);
  const accepted: number[] = [];
  let trials = 0;
  let shown = 0;
  const showLimit = 16;
  while (accepted.length < wanted && trials < maxTrials) {
    const x = rng();
    const threshold = rng();
    trials += 1;
    const keep = threshold <= Math.pow(x, exponent);
    const bin = Math.min(bins - 1, Math.floor(x * bins));
    if (keep) {
      accepted.push(x);
      counts[bin] = (counts[bin] ?? 0) + 1;
    }
    if (shown < showLimit) {
      shown += 1;
      yield {
        stepNumber: index,
        entities: makeBars(bin, keep ? "sorted" : "error"),
        edges: [],
        description: `Trial ${trials}: candidate x=${x.toFixed(4)}, threshold=${threshold.toFixed(4)}; ${keep ? "accepted into bin " + bin : "rejected because threshold exceeds x^p"}.`,
        codeLineNumber: keep ? 3 : 2,
        layout: "array",
        meta: { trials, x, threshold, accepted: keep, bin, totalAccepted: accepted.length },
      };
      index += 1;
    }
  }

  const mean = accepted.reduce((a, b) => a + b, 0) / accepted.length;
  const expectedMean = envelope / (exponent + 2);
  yield {
    stepNumber: index,
    entities: makeBars(-1, "idle"),
    edges: [],
    description: `Accepted ${accepted.length} samples in ${trials} trials; sample mean ${mean.toFixed(4)} versus theoretical ${expectedMean.toFixed(4)}.`,
    codeLineNumber: 5,
    layout: "array",
    meta: {
      exponent,
      trials,
      accepted: accepted.length,
      acceptanceRate: accepted.length / trials,
      mean,
      expectedMean,
      histogram: counts,
      firstSamples: accepted.slice(0, 12),
    },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Rejection sampling draws points from a distribution that is easy to sample and keeps each one with a probability proportional to how much target density sits at that point. Points in high-density regions survive often; points in the tails are usually thrown away. Efficiency depends on how tightly a known multiple of the proposal covers the target.",
    invariants: [
      "The proposal density multiplied by the envelope never falls below the target density.",
      "Each trial consumes two independent uniforms: one candidate and one accept test.",
      "The probability of keeping a candidate at x equals the target density divided by M times the proposal density.",
    ],
    correctness:
      "The joint density of drawing x from the proposal and accepting is g(x) times f(x)/(M g(x)), which equals f(x)/M. The total acceptance probability is therefore 1/M, so conditioning on acceptance leaves density exactly f. Discarded candidates merely rescale the constant and do not bias the retained samples.",
    complexityRationale:
      "Each trial needs a constant number of random draws and arithmetic operations, so accepted samples take M trials in expectation and O(trials) total time. Only the bin histogram and the returned samples need storage, giving O(bins + samples) space.",
    uses: [
      "Drawing from posterior densities in Bayesian computation",
      "Generating test data from nonstandard distributions",
      "A building block inside more advanced Monte Carlo methods",
    ],
    references: [
      "Metropolis, Rosenbluth, Rosenbluth, Teller, and Teller, Equation of State Calculations by Fast Computing Machines, 1953",
      "Robert and Casella, Monte Carlo Statistical Methods, Chapter 2",
    ],
    workedExample:
      "For the target f(x)=2x on [0,1] with a uniform proposal, the envelope is M=2. A candidate x=0.8 is kept when a second uniform is at most 0.8, which happens 80 percent of the time; a candidate x=0.2 survives only 20 percent of the time. Accepted points concentrate near one, with mean 2/3.",
  },
  id: "rejection-sampling",
  name: "Rejection Sampling",
  category: "statistics-probability",
  complexity: { time: "O(trials)", space: "O(bins)" },
  defaultInput: { exponent: 1, samples: 400, bins: 12, seed: 7 },
  visualType: "array",
  run,
  pseudocode: [
    "choose proposal g, envelope M, and target density f",
    "for each trial draw candidate x from g",
    "draw uniform u and set the threshold to u times M times g(x)",
    "accept x when the threshold is at most f(x), otherwise reject it",
    "tally each accepted sample in its histogram bin",
    "stop after the requested number of accepted samples",
    "done: report the sample mean and the acceptance rate",
  ],
};

export default module;

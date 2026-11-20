/**
 * parallel-tempering.ts - Parallel Tempering (Replica Exchange) Swaps
 *
 * Parallel tempering runs several replicas of a Markov chain at different
 * temperatures and periodically proposes swapping their states. Adjacent swaps
 * are accepted with the Metropolis probability that preserves each tempered
 * target. Hot replicas cross energy barriers easily; cold replicas sample the
 * target sharply, and swaps carry those discoveries back down the ladder.
 *
 * Time: O(sweeps * replicas). Space: O(replicas).
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

/** Geometric inverse-temperature ladder from minBeta to maxBeta. */
export function temperatureLadder(minBeta: number, maxBeta: number, replicas: number): number[] {
  const n = Math.max(2, Math.floor(replicas));
  const ratio = maxBeta / minBeta;
  return Array.from({ length: n }, (_, i) => minBeta * Math.pow(ratio, i / (n - 1)));
}

/** Metropolis acceptance probability for swapping adjacent replicas. */
export function swapAcceptance(betaI: number, betaJ: number, uI: number, uJ: number): number {
  const exponent = (betaI - betaJ) * (uI - uJ);
  return Math.min(1, Math.exp(exponent));
}

export interface ExchangeResult {
  energies: number[];
  acceptances: number[];
  swaps: number;
}

/** Perform adjacent replica-exchange sweeps with a seeded generator. */
export function replicaExchange(
  betas: number[],
  energies: number[],
  sweeps: number,
  seed: number,
): ExchangeResult {
  const current = [...energies];
  const random = mulberry32(seed);
  const acceptances: number[] = [];
  let swaps = 0;
  for (let sweep = 0; sweep < sweeps; sweep += 1) {
    const parity = sweep % 2;
    for (let i = parity; i + 1 < betas.length; i += 2) {
      const alpha = swapAcceptance(
        betas[i] as number,
        betas[i + 1] as number,
        current[i] as number,
        current[i + 1] as number,
      );
      acceptances.push(alpha);
      if (random() < alpha) {
        const tmp = current[i] as number;
        current[i] = current[i + 1] as number;
        current[i + 1] = tmp;
        swaps += 1;
      }
    }
  }
  return { energies: current, acceptances, swaps };
}

function bars(values: number[], active: number): VisualEntity[] {
  return values.map((value, i) => ({
    id: `pair-${i}`,
    type: "bar" as const,
    label: `pair ${i}-${i + 1}: p ${value.toFixed(3)}`,
    value,
    state: (i === active ? "comparing" : i < active ? "sorted" : "unvisited") as EntityState,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    metadata: { pair: i, acceptance: value },
  }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as {
    minBeta?: number;
    maxBeta?: number;
    replicas?: number;
    sweeps?: number;
    seed?: number;
  } | null) ?? {};
  const minBeta = Number(task.minBeta) > 0 ? Number(task.minBeta) : 0.01;
  const maxBeta = Number(task.maxBeta) > minBeta ? Number(task.maxBeta) : 1;
  const replicas = Math.max(2, Math.min(16, Math.floor(Number(task.replicas ?? 6)) || 6));
  const sweeps = Math.max(1, Math.min(50, Math.floor(Number(task.sweeps ?? 8)) || 8));
  const seed = Math.floor(Number(task.seed ?? 5)) || 5;

  const betas = temperatureLadder(minBeta, maxBeta, replicas);
  const energies = betas.map((beta, i) => 0.5 * (1 - beta) * (i % 3) + 0.2 * i);
  const result = replicaExchange(betas, energies, sweeps, seed);
  const pairAcceptances = betas.slice(0, -1).map((beta, i) =>
    swapAcceptance(beta, betas[i + 1] as number, energies[i] as number, energies[i + 1] as number),
  );

  let index = 0;
  yield {
    stepNumber: index,
    entities: bars(pairAcceptances, -1),
    edges: [],
    description: `Parallel tempering with ${replicas} replicas from beta ${minBeta} to ${maxBeta} over ${sweeps} sweeps.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { minBeta, maxBeta, replicas, sweeps, seed, betas },
  };
  index += 1;

  for (let i = 0; i < pairAcceptances.length; i += 1) {
    yield {
      stepNumber: index,
      entities: bars(pairAcceptances, i),
      edges: [],
      description: `Adjacent pair ${i}-${i + 1}: swap acceptance probability ${(pairAcceptances[i] as number).toFixed(4)}.`,
      codeLineNumber: 2,
      layout: "array",
      meta: { pair: i, betaI: betas[i] as number, betaJ: betas[i + 1] as number, acceptance: pairAcceptances[i] as number },
    };
    index += 1;
  }

  yield {
    stepNumber: index,
    entities: bars(pairAcceptances, pairAcceptances.length - 1),
    edges: [],
    description: `After ${sweeps} sweeps, ${result.swaps} replica swaps were accepted.`,
    codeLineNumber: 4,
    layout: "array",
    meta: { swaps: result.swaps, sweeps, energies: result.energies, acceptances: result.acceptances, done: true },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Parallel tempering runs the same sampler at a ladder of temperatures. Hot replicas roam widely and escape local modes, while cold replicas explore the target in detail. Proposing to swap neighboring replicas lets a configuration found in a hot chain migrate to colder chains; the swap is accepted with a Metropolis rule that keeps every tempered chain at its correct distribution.",
    invariants: [
      "Every acceptance probability lies between zero and one.",
      "A hot replica with higher energy than its cold neighbor swaps with probability one.",
      "The swap rule satisfies detailed balance for the product of tempered targets.",
    ],
    correctness:
      "For replicas at betas i and j with energies Ui and Uj, the swap ratio of target densities is exp((beta_i - beta_j)(Ui - Uj)), so the Metropolis minimum of one and that ratio leaves the joint tempered product invariant. Because the swap proposal is symmetric and only adjacent pairs are swapped, each elementary move is reversible and the chain retains the correct stationary distribution.",
    complexityRationale:
      "Each sweep visits adjacent pairs once, so one exchange step is O(replicas); over sweeps the cost is O(sweeps * replicas) with O(replicas) space for the energy array.",
    uses: [
      "Sampling multimodal posterior distributions in Bayesian inference",
      "Simulating spin glasses and proteins with rugged energy landscapes",
      "Improving mixing of Markov chains in high-dimensional models",
    ],
    references: [
      "Swendsen and Wang, Replica Monte Carlo Simulation of Spin-Glasses, 1986",
      "Earl and Deem, Parallel Tempering: Theory, Applications, and New Perspectives, 2005",
    ],
    workedExample:
      "With betas 1 and 0.5, a cold energy of 0.2 and a hot energy of 2.0, the exponent is (1 - 0.5)(0.2 - 2.0) = -0.9, giving acceptance exp(-0.9) about 0.407. If the hotter replica instead had energy 0.1, the exponent becomes positive and the swap is always accepted.",
  },
  id: "parallel-tempering",
  name: "Parallel Tempering",
  category: "statistics-probability",
  complexity: { time: "O(sweeps * replicas)", space: "O(replicas)" },
  defaultInput: { minBeta: 0.01, maxBeta: 1, replicas: 6, sweeps: 8, seed: 5 },
  visualType: "array",
  run,
  pseudocode: [
    "input a geometric ladder of inverse temperatures",
    "assign one replica and current energy to each rung",
    "for each alternating sweep over adjacent pairs of rungs",
    "compute the swap acceptance min(1, exp((beta_i - beta_j)(U_i - U_j)))",
    "draw a uniform number and exchange energies when it is below acceptance",
    "record the number of accepted swaps",
    "done: report the final energy assignment and swap count",
  ],
};

export default module;

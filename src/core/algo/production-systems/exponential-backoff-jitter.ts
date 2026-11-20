/**
 * exponential-backoff-jitter.ts - Exponential Backoff with Jitter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When a client retries a failing request it waits longer after each failure,
 * doubling a base delay up to a cap. If every client used the exact same delay
 * they would retry in lockstep and keep colliding. Jitter randomizes each wait
 * so retries spread out. Full jitter picks a uniform delay between zero and
 * the current ceiling; equal jitter splits the ceiling in half and randomizes
 * only one half; decorrelated jitter multiplies the previous delay by three
 * and randomizes up to that product, capped at the ceiling.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(maxRetries) to derive every delay
 *   Space: O(maxRetries) for the delay trace and rendered bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each bar is the delay before one retry, indexed by attempt number.
 *   - Revealed delays are GREEN (sorted); the current one is BLUE (comparing).
 *   - The final caption reports total wait and the ceiling reached.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Strategy = "full" | "equal" | "decorrelated";

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

/** Deterministic schedule of delays for all strategies. */
export function backoffSchedule(
  base: number,
  cap: number,
  retries: number,
  seed: number,
  strategy: Strategy,
): { ceilings: number[]; delays: number[] } {
  const rng = makeRng(seed);
  const ceilings: number[] = [];
  const delays: number[] = [];
  let previous = base;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const ceiling = Math.min(cap, base * Math.pow(2, attempt));
    ceilings.push(ceiling);
    let delay: number;
    if (strategy === "full") {
      delay = rng() * ceiling;
    } else if (strategy === "equal") {
      const half = ceiling / 2;
      delay = half + rng() * half;
    } else {
      delay = Math.min(ceiling, rng() * previous * 3);
      previous = delay;
    }
    delays.push(delay);
  }
  return { ceilings, delays };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as {
    base?: number;
    cap?: number;
    retries?: number;
    seed?: number;
    strategy?: Strategy;
  } | null) ?? {};
  const base = typeof task.base === "number" && task.base > 0 ? task.base : 0.1;
  const cap = typeof task.cap === "number" && task.cap >= base ? task.cap : 5;
  const retries = typeof task.retries === "number" ? Math.max(1, Math.min(60, task.retries | 0)) : 10;
  const seed = typeof task.seed === "number" ? task.seed : 123;
  const strategy: Strategy = task.strategy === "equal" || task.strategy === "decorrelated" ? task.strategy : "full";

  const { ceilings, delays } = backoffSchedule(base, cap, retries, seed, strategy);

  const makeBars = (revealed: number): VisualEntity[] =>
    delays.map((delay, i) => ({
      id: `bar-${i}`,
      type: "bar" as const,
      label: delay.toFixed(3),
      value: delay,
      state:
        i < revealed - 1
          ? ("sorted" as EntityState)
          : i === revealed - 1
            ? ("comparing" as EntityState)
            : ("unvisited" as EntityState),
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      metadata: { row: 0, col: i, ceiling: ceilings[i] ?? 0 },
    }));

  let index = 0;
  yield {
    stepNumber: index,
    entities: makeBars(0),
    edges: [],
    description: `${strategy} jitter, base ${base}, cap ${cap}, ${retries} retries from seed ${seed}.`,
    codeLineNumber: 0,
    layout: "array",
    meta: { base, cap, retries, seed, strategy },
  };
  index += 1;

  for (let i = 0; i < retries; i += 1) {
    yield {
      stepNumber: index,
      entities: makeBars(i + 1),
      edges: [],
      description: `Attempt ${i + 1}: ceiling ${(ceilings[i] ?? 0).toFixed(3)}, ${strategy} jitter yields a ${(delays[i] ?? 0).toFixed(3)} second wait.`,
      codeLineNumber: strategy === "full" ? 2 : strategy === "equal" ? 3 : 4,
      layout: "array",
      meta: { attempt: i + 1, ceiling: ceilings[i] ?? 0, delay: delays[i] ?? 0 },
    };
    index += 1;
  }

  const total = delays.reduce((a, b) => a + b, 0);
  yield {
    stepNumber: index,
    entities: makeBars(retries),
    edges: [],
    description: `Total wait ${total.toFixed(3)} seconds across ${retries} retries; ceiling reached ${(ceilings[retries - 1] ?? 0).toFixed(3)}.`,
    codeLineNumber: 6,
    layout: "array",
    meta: { total, ceilings, delays, strategy },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Exponential backoff makes a client wait twice as long after each failed request, but identical clients would still retry at the same instant and collide again. Jitter breaks the synchronization by randomizing the wait. Full jitter draws uniformly from zero up to the current ceiling and spreads retries most widely, while equal and decorrelated jitter trade some spread for a guaranteed minimum wait.",
    invariants: [
      "The ceiling starts at the base delay and doubles until it reaches the cap.",
      "Under full jitter every delay lies between zero and the current ceiling.",
      "The schedule is reproducible for a fixed seed, which makes replay deterministic.",
    ],
    correctness:
      "The ceiling after k failures is min(cap, base times two to the k), so the doubling and saturation are exact. Full jitter samples uniformly on [0, ceiling], giving an expected delay of ceiling/2 and minimizing the probability that two independent clients choose the same retry time. Decorrelated jitter uses the previous delay to adapt quickly without requiring shared state.",
    complexityRationale:
      "Each retry computes one ceiling and a constant number of arithmetic operations, so deriving the whole schedule takes O(retries) time. Storing the ceilings, delays, and one bar per attempt uses O(retries) space.",
    uses: [
      "Retrying HTTP requests after throttling or server errors",
      "Collision resolution in wireless and shared-medium networks",
      "Leader election and lock acquisition in distributed systems",
    ],
    references: [
      "Metcalfe and Boggs, Ethernet: Distributed Packet Switching for Local Computer Networks, 1976",
      "AWS Builders' Library, Exponential Backoff and Jitter, 2015",
    ],
    workedExample:
      "With base 0.1 seconds, cap 5 seconds, and full jitter, the first ceiling is 0.1 and the delay is uniform on [0, 0.1]. The next ceilings are 0.2, 0.4, 0.8 and so on until 5. At saturation the average wait is 2.5 seconds, spread randomly so concurrent clients rarely collide.",
  },
  id: "exponential-backoff-jitter",
  name: "Exponential Backoff with Jitter",
  category: "production-systems",
  complexity: { time: "O(retries)", space: "O(retries)" },
  defaultInput: { base: 0.1, cap: 5, retries: 10, seed: 123, strategy: "full" },
  visualType: "array",
  run,
  pseudocode: [
    "input base delay, cap, retry count, and jitter strategy",
    "for each attempt set ceiling to min(cap, base times 2^attempt)",
    "full jitter: draw a uniform delay between zero and the ceiling",
    "equal jitter: add a uniform half to half the ceiling",
    "decorrelated jitter: randomize up to three times the previous delay",
    "record the delay and advance to the next attempt",
    "done: report every delay and the total wait",
  ],
};

export default module;

/**
 * ben-or-consensus.ts - Ben-Or Randomized Consensus (Core Round Logic)
 *
 * Ben-Or's protocol lets processes agree on a binary value even when some
 * processes behave arbitrarily. In each round a process broadcasts its current
 * estimate; if it sees a strict majority it adopts that value, and otherwise
 * it flips a local coin. With a fair coin the probability that all honest
 * processes disagree after a round is bounded away from one, so agreement is
 * reached almost surely after enough rounds.
 *
 * This simulation uses a deterministic pseudo-random coin derived from the
 * input seed, models only crash-free processes with perfect message delivery,
 * and omits Byzantine value manipulation, message authentication, and the
 * two-consecutive-round safety rule. It demonstrates the majority-and-coin
 * core, not a deployable asynchronous protocol.
 *
 * Time:  O(rounds * n) for n processes
 * Space: O(rounds * n) for the visible estimate history
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface BenOrInput {
    inputs?: number[];
    seed?: number;
    maxRounds?: number;
}

/** Deterministic fair-ish coin from a seed, round, and process id. */
function coin(seed: number, round: number, pid: number): number {
    let value = (seed + round * 7919 + pid * 104729) >>> 0;
    value = (Math.imul(value, 1103515245) + 12345) >>> 0;
    return (value >>> 16) & 1;
}

function makeCells(history: number[][], rounds: number, active: number, final: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < history.length; row += 1) {
        for (let col = 0; col < rounds; col += 1) {
            const value = history[row]?.[col];
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value === undefined ? "-" : String(value),
                value: value ?? 0,
                state: final ? "sorted" : col === active ? "comparing" : value === undefined ? "idle" : "visited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, process: row, round: col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BenOrInput | null) ?? {};
    const inputs = Array.isArray(task.inputs) && task.inputs.length >= 1
        ? task.inputs.slice(0, 8).map((v) => (Number(v) === 1 ? 1 : 0))
        : [0, 0, 1, 1];
    const n = inputs.length;
    const seed = Math.floor(Number(task.seed ?? 7)) || 7;
    const maxRounds = Math.min(40, Math.max(1, Math.floor(Number(task.maxRounds ?? 12)) || 12));
    const history: number[][] = inputs.map((value) => [value]);

    yield {
        stepNumber: 0,
        entities: makeCells(history, 1, -1, false),
        edges: [],
        description: `${n} processes start with their private binary inputs; each will broadcast an estimate per round.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { processes: n, rounds: 0, seed, estimates: [...inputs], decision: null, converged: false, done: false },
    };

    let estimates = [...inputs];
    let step = 1;
    let decision: number | null = null;
    for (let round = 0; round < maxRounds; round += 1) {
        const zeros = estimates.filter((value) => value === 0).length;
        const ones = n - zeros;
        const next = estimates.map((_value, pid) => {
            if (zeros > n / 2) {
                return 0;
            }
            if (ones > n / 2) {
                return 1;
            }
            return coin(seed, round, pid);
        });
        for (let pid = 0; pid < n; pid += 1) {
            history[pid]?.push(next[pid] ?? 0);
        }
        const unanimous = next.every((value) => value === next[0]);
        if (unanimous) {
            decision = next[0] ?? 0;
        }
        estimates = next;
        yield {
            stepNumber: step,
            entities: makeCells(history, round + 2, round + 1, unanimous),
            edges: [],
            description: `Round ${round + 1}: saw ${zeros} zeros and ${ones} ones; new estimates ${next.join("")}${unanimous ? " - agreement reached" : " - no majority, coins flipped"}.`,
            codeLineNumber: unanimous ? 6 : round === 0 ? 2 : 4,
            layout: "grid",
            meta: {
                processes: n,
                rounds: round + 1,
                seed,
                estimates: [...next],
                decision,
                converged: unanimous,
                done: unanimous,
            },
        };
        step += 1;
        if (unanimous) {
            break;
        }
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Randomized consensus replaces deterministic tie breaking with coin flips. Everyone broadcasts what they currently believe. If a value has a strict majority, adopting it is safe because two different majorities cannot exist at once. When the votes are split, each process flips its own coin; since the coins are independent, the split is likely to break, and repeating the round eventually produces a majority that everyone adopts.",
        invariants: [
            "A value adopted by majority is held by more than half of the processes.",
            "Once all processes hold the same value, later majority tests keep that value.",
            "Two different values cannot both have a strict majority in the same round.",
        ],
        correctness:
            "Safety follows because any two strict majorities in a set of n processes intersect, so a process that already adopted one value can never see a strict majority for the other. For liveness, when no value has a majority every process flips an independent fair coin; the chance that all n coins reproduce a non-unanimous split is strictly less than one, so the probability of remaining split after k such rounds decays exponentially and agreement occurs almost surely.",
        complexityRationale:
            "Each round broadcasts one value per process and counts them, costing O(n) work per round, so k rounds take O(k n) time. Keeping the visible history of estimates uses O(k n) space.",
        uses: [
            "A teaching model for fault-tolerant binary agreement",
            "The decision core of randomized Byzantine agreement protocols",
            "Understanding why randomness can bypass deterministic impossibility results",
        ],
        references: [
            "Ben-Or, Another Advantage of Free Choice, 1983",
            "Lynch, Distributed Algorithms, Chapter 13",
        ],
        workedExample:
            "Four processes start 0011, a perfect split with no majority. Each flips a coin; suppose the coins give 0001, which has three zeros. In the next round every process sees a zero majority and adopts zero, so all four decide zero.",
    },
    id: "ben-or-consensus",
    name: "Ben-Or Consensus",
    category: "parallel-distributed",
    complexity: { time: "O(rounds * n)", space: "O(rounds * n)" },
    defaultInput: { inputs: [0, 0, 1, 1], seed: 7, maxRounds: 12 },
    visualType: "grid",
    run,
    pseudocode: [
        "each process starts with its private binary input",
        "for each round up to the allowed maximum",
        "broadcast the current estimate to every process",
        "if a value has a strict majority, adopt that value",
        "otherwise set the estimate to an independent coin flip",
        "check whether all estimates now agree",
        "if they agree, decide that value and stop",
        "done: report the common decision and the round count",
    ],
};

export default module;

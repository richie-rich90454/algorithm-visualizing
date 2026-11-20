/**
 * delegated-proof-of-stake.ts - Delegated Proof of Stake (Elect and Schedule Witnesses)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Delegated Proof of Stake lets token holders elect a small set of witnesses
 * who produce blocks on their behalf. Voters choose the candidates with the
 * most stake backing, and the elected witnesses then take turns producing
 * blocks in a schedule whose frequency is proportional to their stake. This
 * reduces the number of consensus participants and speeds up block production
 * while keeping stake-weighted representation.
 *
 * This deterministic teaching simulation elects the top-k candidates by stake
 * and builds a stake-weighted block schedule using largest-remainder rounding.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(C log C) to rank C candidates, O(R) to build R block slots
 *   Space: O(C + R) for the ranking and the schedule
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per candidate encodes its stake.
 *   - Elected witnesses are green; others stay amber.
 *   - The final frame reports the stake-weighted block schedule.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface DPoSData {
    candidates: string[];
    stakes: number[];
    delegates: number;
    elected: number[];
    schedule: number[];
    rounds: number;
    counts: number[];
}

/** Deterministic DPoS election and stake-weighted block schedule. */
export function simulateDelegatedProofOfStake(
    stakes: number[],
    delegates: number,
    rounds: number,
): DPoSData {
    const n = stakes.length;
    const d = n === 0 ? 0 : Math.min(n, Math.max(1, Math.floor(delegates)));
    const r = Math.max(0, Math.floor(rounds));
    const ranked = stakes.map((stake, index) => ({ stake, index }))
        .sort((a, b) => b.stake - a.stake || a.index - b.index);
    const elected = ranked.slice(0, d).map((entry) => entry.index);
    const weights = elected.map((index) => Math.max(0, stakes[index] ?? 0));
    const total = weights.reduce((sum, w) => sum + w, 0);
    const raw = elected.map((_, k) => (total > 0 ? ((weights[k] ?? 0) * r) / total : r / Math.max(1, d)));
    const counts = raw.map((value) => Math.floor(value));
    let remaining = r - counts.reduce((sum, c) => sum + c, 0);
    const byRemainder = raw.map((_, k) => k)
        .sort((a, b) => ((raw[b] ?? 0) - (counts[b] ?? 0)) - ((raw[a] ?? 0) - (counts[a] ?? 0)) || a - b);
    for (let k = 0; k < byRemainder.length && remaining > 0; k += 1) {
        const idx = byRemainder[k] ?? 0;
        counts[idx] = (counts[idx] ?? 0) + 1;
        remaining -= 1;
    }
    const schedule: number[] = [];
    counts.forEach((count, k) => {
        for (let j = 0; j < count; j += 1) schedule.push(elected[k] ?? 0);
    });
    return { candidates: [], stakes: [...stakes], delegates: d, elected, schedule, rounds: r, counts };
}

/** Bars, one per candidate. */
function makeBars(data: DPoSData, states: EntityState[]): VisualEntity[] {
    return data.stakes.map((stake, index) => ({
        id: `candidate-${index}`,
        type: "bar" as const,
        label: `C${index}`,
        value: stake,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, stake },
    }));
}

/** The Delegated Proof of Stake generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { stakes?: number[]; delegates?: number; rounds?: number } | null) ?? {};
    const stakes = Array.isArray(task.stakes) && task.stakes.length > 0
        ? task.stakes.map((s) => (typeof s === "number" ? s : 0))
        : [40, 30, 20, 10, 5];
    const data = simulateDelegatedProofOfStake(stakes, task.delegates ?? 3, task.rounds ?? 10);
    data.candidates = stakes.map((_, i) => `C${i}`);

    yield {
        stepNumber: 0,
        entities: makeBars(data, Array<EntityState>(data.stakes.length).fill("idle")),
        edges: [],
        description: `Delegated Proof of Stake with ${data.stakes.length} candidates; token holders elect ${data.delegates} witnesses to produce blocks.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { candidates: data.stakes.length, delegates: data.delegates, rounds: data.rounds, phase: "setup" },
    };

    const electedStates: EntityState[] = data.stakes.map((_, i) =>
        data.elected.includes(i) ? "sorted" : "active",
    );
    yield {
        stepNumber: 1,
        entities: makeBars(data, electedStates),
        edges: [],
        description: `Election: candidates [${data.elected.join(", ")}] received the most stake and become block-producing witnesses.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { candidates: data.stakes.length, delegates: data.delegates, elected: data.elected, phase: "elect" },
    };

    const scheduleStates: EntityState[] = data.stakes.map((_, i) =>
        data.elected.includes(i) ? "comparing" : "unvisited",
    );
    const counts = data.elected.map((index) => `${index}:${data.counts[data.elected.indexOf(index)] ?? 0}`);
    yield {
        stepNumber: 2,
        entities: makeBars(data, scheduleStates),
        edges: [],
        description: `Stake-weighted schedule for ${data.rounds} blocks: witness counts ${counts.join(", ")}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { candidates: data.stakes.length, rounds: data.rounds, elected: data.elected, counts: data.counts, phase: "schedule" },
    };

    yield {
        stepNumber: 3,
        entities: makeBars(data, electedStates),
        edges: [],
        description: `Block producers for the next ${data.rounds} rounds are [${data.schedule.join(", ")}].`,
        codeLineNumber: 6,
        layout: "array",
        meta: { candidates: data.stakes.length, rounds: data.rounds, schedule: data.schedule, phase: "done" },
    };
}

/** The Delegated Proof of Stake module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Token holders do not validate every block themselves. They vote for a small group of witnesses, and those witnesses rotate through block production with frequency proportional to the stake behind them. Fewer participants means faster agreement, while the election keeps the witnesses accountable to stakeholders.",
        invariants: [
            "The elected witnesses are exactly the top-k candidates by stake, with ties broken by index.",
            "The block schedule length equals the number of rounds.",
            "Block counts use largest-remainder rounding so they sum to the round count.",
        ],
        correctness:
            "Sorting by stake with a deterministic tie-break yields a unique elected set that reflects voter weight. Largest-remainder apportionment assigns each witness a block count within one of its exact stake share and guarantees the counts sum to the number of rounds, so the schedule is both fair and complete. Because witness selection and order are public and deterministic, all nodes agree on who may sign each round.",
        complexityRationale:
            "Ranking C candidates costs O(C log C). Computing weights and expanding the schedule takes O(C + R) for R rounds. The ranking and schedule occupy O(C + R) space.",
        uses: [
            "Delegated block production in EOS-style and Tron-style chains",
            "Governance systems where stakeholders elect a small validator committee",
            "Teaching stake-weighted scheduling and apportionment",
        ],
        references: [
            "Larimer, Delegated Proof of Stake: An Introduction, 2014",
            "Buterin, On Stake, Slashing, and Delegation, 2017",
        ],
        workedExample:
            "Candidates with stakes 40, 30, 20, 10, 5 elect the top three: 0, 1, and 2. Over ten blocks their exact shares are roughly 4.4, 3.3, and 2.2, so largest-remainder rounding gives counts 5, 3, and 2 and a ten-block schedule.",
    },
    id: "delegated-proof-of-stake",
    name: "Delegated Proof of Stake",
    category: "parallel-distributed",
    complexity: { time: "O(C log C + R)", space: "O(C+R)" },
    defaultInput: { stakes: [40, 30, 20, 10, 5], delegates: 3, rounds: 10 },
    visualType: "array",
    run,
    pseudocode: [
        "collect the stake backing each candidate",
        "sort candidates by stake descending with index tie-break",
        "elect the top k candidates as witnesses",
        "compute each witness's share of the total elected stake",
        "assign floor shares of the R block slots",
        "give leftover slots to the largest remainders",
        "expand the counts into a round-by-round schedule",
        "done: report the elected witnesses and block schedule",
    ],
};

export default module;

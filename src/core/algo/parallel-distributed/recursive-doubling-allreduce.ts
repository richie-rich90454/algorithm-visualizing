/**
 * recursive-doubling-allreduce.ts - Recursive Doubling Allreduce
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Recursive doubling allreduces a value across p processes in log(p) rounds.
 * In round r every process exchanges its accumulator with the partner whose
 * rank differs in bit r, and both add the two partial results. After one
 * exchange the pair shares a sum of two ranks; after two, a sum of four; and
 * after log(p) rounds every process holds the reduction of all p values.
 * It is the allreduce used in high-performance MPI collectives.
 *
 * This is a deterministic teaching simulation over an in-memory rank array.
 * It performs the exact exchange schedule and arithmetic of recursive doubling,
 * but there is no actual message passing, no network topology, and no overlap
 * with computation. Only the communication pattern is faithful.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log(p) * m) for m values per process and p processes
 *   Space: O(p * m) to hold every rank's accumulator in the simulation
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cell (rank, step) shows that rank's accumulator after step exchanges.
 *   - The accumulator being updated is yellow; the finished column is green.
 *   - meta carries the exchange schedule, per-step values, and the final total.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function nextPowerOfTwo(value: number): number {
    let p = 1;
    while (p < value) {
        p *= 2;
    }
    return p;
}

/** Build the rank-by-step accumulator grid from a fully computed history. */
function makeCells(history: number[][], activeStep: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const p = history[0]?.length ?? 0;
    for (let rank = 0; rank < p; rank += 1) {
        for (let step = 0; step < history.length; step += 1) {
            const value = history[step]?.[rank] ?? 0;
            let state: EntityState = "unvisited";
            if (done) {
                state = "sorted";
            } else if (step === activeStep) {
                state = "comparing";
            } else if (step < activeStep) {
                state = "visited";
            }
            entities.push({
                id: `cell-${rank}-${step}`,
                type: "cell",
                label: `p${rank}:${value.toFixed(3)}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: rank, col: step, rank, step, value },
            });
        }
    }
    return entities;
}

/** The recursive doubling allreduce generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const raw = Array.isArray(task.values) && task.values.length > 0 ? task.values : [1, 2, 3, 4, 5, 6, 7, 8];
    const p = nextPowerOfTwo(Math.min(64, Math.max(1, raw.length)));
    const values = Array.from({ length: p }, (_, index) => Number(raw[index] ?? 0) || 0);
    const rounds = Math.log2(p);
    const total = values.reduce((sum, value) => sum + value, 0);

    const history: number[][] = [values.map((value) => value)];
    let acc = [...values];
    const schedule: Array<Array<{ rank: number; partner: number }>> = [];

    // Compute the entire exchange history up front so every frame has a stable grid.
    for (let r = 0; r < rounds; r += 1) {
        const mask = 1 << r;
        const snapshot = [...acc];
        const roundSchedule: Array<{ rank: number; partner: number }> = [];
        for (let rank = 0; rank < p; rank += 1) {
            roundSchedule.push({ rank, partner: rank ^ mask });
        }
        schedule.push(roundSchedule);
        for (let rank = 0; rank < p; rank += 1) {
            const partner = rank ^ mask;
            acc[rank] = (snapshot[rank] ?? 0) + (snapshot[partner] ?? 0);
        }
        history.push([...acc]);
    }

    const meta = (step: number, done: boolean) => ({
        rows: p,
        cols: rounds + 1,
        p,
        rounds,
        step,
        values: [...values],
        total,
        historyFlat: history.flat(),
        schedule: schedule
            .map((round) => round.map((pair) => `${pair.rank}-${pair.partner}`).join(","))
            .join("|"),
        done,
        note: "deterministic recursive doubling simulation: in-memory exchange, no real network",
    });

    yield {
        stepNumber: 0,
        entities: makeCells(history, 0, false),
        edges: [],
        description: `${p} ranks each start with their own value; the allreduce will sum them in ${rounds} round(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, false),
    };
    let step = 1;

    for (let r = 0; r < rounds; r += 1) {
        const mask = 1 << r;
        yield {
            stepNumber: step,
            entities: makeCells(history, step, false),
            edges: [],
            description: `Round ${r + 1}: each rank exchanges with the partner differing in bit ${r} (mask ${mask}), doubling the group summed from ${2 ** r} to ${2 ** (r + 1)} ranks.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(step, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(history, step, true),
        edges: [],
        description: `All ${p} ranks now hold the same reduction total ${total.toFixed(6)} after ${rounds} exchange round(s).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: meta(step, true),
    };
}

/** The recursive doubling allreduce module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Number the processes and, in each round, have every process swap its running total with the one partner whose rank differs by one bit. Both processes add what they receive, so the group whose sum they hold doubles every round. After log(p) rounds, every process has walked through all the bit positions and therefore holds the sum of everyone.",
        invariants: [
            "After round r, a process holds the sum of exactly 2^r consecutive ranks sharing its low r bits.",
            "The exchange schedule pairs each rank with exactly one partner per round, and each pair computes the same sum.",
            "No process ever contributes its value more than once because each doubling merges disjoint groups.",
        ],
        correctness:
            "Represent ranks in binary. In round r a rank and its partner differ only in bit r, so they belong to the two halves of a group of 2^(r+1) ranks that agree on bits above r. By induction they arrive with the sums of those two disjoint halves, and adding them yields the sum of the whole group. At r = log(p) - 1 the group is all p ranks, so every process stores the total reduction.",
        complexityRationale:
            "Each of the log(p) rounds exchanges and adds the full m-element message once per process, so the time per process is O(log(p) * m). Holding the accumulator plus the simulation's history of every rank costs O(p * m) space in this visualization, though a real implementation needs only O(m) per process.",
        uses: [
            "Gradient aggregation in distributed deep learning",
            "MPI collective operations in scientific simulations",
            "Global reductions in data-parallel high-performance computing",
        ],
        references: [
            "Gropp, Lusk and Skjellum, Using MPI, Chapter 5",
            "Thakur, Rabenseifner and Gropp, Optimization of Collective Communication Operations in MPICH, 2005",
        ],
        workedExample:
            "With values [1, 2, 3, 4] on four ranks, round one pairs 0 with 1 and 2 with 3, producing partial sums 3, 3, 7, 7. Round two pairs 0 with 2 and 1 with 3, so all four ranks end with 10, the total of the input values.",
    },
    id: "recursive-doubling-allreduce",
    name: "Recursive Doubling Allreduce",
    category: "parallel-distributed",
    complexity: { time: "O(log(p) * m)", space: "O(p * m)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6, 7, 8] },
    visualType: "grid",
    run,
    pseudocode: [
        "number the p processes from zero and start each accumulator at its own value",
        "for each round r from zero to log base two of p minus one",
        "pair each rank with the partner found by flipping bit r of its rank",
        "exchange accumulators with the partner",
        "add the received accumulator into the local one",
        "repeat for all ranks in the round before moving on",
        "after the last round every rank holds the full reduction",
        "done: report the common total and the exchange schedule",
    ],
};

export default module;

/**
 * warp-shuffle-reduction.ts - Warp Shuffle Reduction
 *
 * A warp-level sum with no shared memory. Starting at an offset of half the
 * warp, each active lane adds the value of the lane offset positions away, then
 * the offset halves. After log2(lanes) rounds lane 0 holds the total.
 *
 * Time:  O(log lanes) parallel shuffle rounds
 * Space: O(lanes) for the per-lane register values
 *
 * Visualization: bars show each lane's current value; the lanes that add in a
 * round are highlighted, and the final frame marks lane 0 with the result.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Butterfly shuffle reduction; returns every round for verification. */
export function shuffleReduce(values: number[]): { result: number; rounds: Array<{ offset: number; values: number[] }> } {
    const work = values.slice();
    const rounds: Array<{ offset: number; values: number[] }> = [];
    const n = work.length;
    if (n === 0) return { result: 0, rounds };
    let offset = 1;
    while (offset * 2 < n) offset *= 2;
    while (offset >= 1) {
        for (let lane = 0; lane + offset < n; lane += 1) {
            work[lane] = (work[lane] as number) + (work[lane + offset] as number);
        }
        rounds.push({ offset, values: work.slice() });
        offset = Math.floor(offset / 2);
    }
    return { result: work[0] as number, rounds };
}

/** One bar per lane, highlighting the lanes that add in the current round. */
function makeBars(values: number[], highlightOffset: number | null, done: boolean): VisualEntity[] {
    return values.map((value, lane) => {
        let state: EntityState = "idle";
        if (done && lane === 0) state = "sorted";
        else if (highlightOffset !== null && lane < highlightOffset) state = "comparing";
        return {
            id: `lane-${lane}`,
            type: "bar" as const,
            label: String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { lane },
        };
    });
}

/** The warp shuffle reduction generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; lanes?: number } | null) ?? {};
    const raw = Array.isArray(task.values) ? task.values.map((v) => Number(v) || 0) : [1, 2, 3, 4, 5, 6, 7, 8];
    const lanes = typeof task.lanes === "number" && task.lanes > 0 ? Math.floor(task.lanes) : 8;
    const values = raw.slice(0, lanes);
    while (values.length < lanes) values.push(0);
    const reduced = shuffleReduce(values);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, null, false),
        edges: [],
        description: `${lanes} lanes start with [${values.join(", ")}]; only lane 0 will hold the final sum.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "init", lanes, values: [...values], offset: 0, result: 0 },
    };
    step += 1;

    for (const round of reduced.rounds) {
        yield {
            stepNumber: step,
            entities: makeBars(round.values, round.offset, false),
            edges: [],
            description: `Offset ${round.offset}: lanes 0..${round.offset - 1} add the value ${round.offset} lane(s) away.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { phase: "shuffle", lanes, values: round.values, offset: round.offset, result: round.values[0] ?? 0 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(reduced.rounds.length > 0 ? (reduced.rounds[reduced.rounds.length - 1] as { values: number[] }).values : values, null, true),
        edges: [],
        description: `Reduction complete after ${reduced.rounds.length} shuffle round(s): lane 0 = ${reduced.result}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "done", lanes, values: [...values], offset: 0, result: reduced.result, rounds: reduced.rounds.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of writing partial sums to shared memory and synchronizing, a warp can shuffle register values directly between lanes. Every active lane adds the value held by a lane a fixed offset away, and the offset is halved each round. After log2 of the warp size rounds the values have folded into lane 0, which holds the total.",
        invariants: [
            "In a round with offset d, only lanes below d change their value.",
            "The offset strictly halves each round until it reaches one.",
            "After each round, lane 0 holds the sum of a growing prefix of the original lanes.",
        ],
        correctness:
            "A round with offset d adds to lane k the value of lane k+d, so after the first round lane 0 holds lanes 0 and 1 summed when d is half the warp. Because the offset halves, subsequent rounds fold progressively larger blocks: this is the standard butterfly reduction tree, in which each original value is added into lane 0 exactly once along a path of logarithmic length. Therefore lane 0 ends with the sum of every lane.",
        complexityRationale:
            "There are log2(lanes) rounds and each round performs at most lanes/2 lane additions in parallel, so the critical path is O(log lanes) shuffle steps with O(lanes) total work. Only one value per lane is stored, O(lanes) space.",
        uses: [
            "GPU reduction kernels in CUDA and HIP",
            "Parallel sum, min, and max primitives in deep-learning libraries",
            "Fast intra-warp aggregation without shared-memory barriers",
        ],
        references: [
            "NVIDIA, CUDA C Programming Guide, warp shuffle functions",
            "Harris, Optimizing Parallel Reduction in CUDA, NVIDIA developer documentation",
        ],
        workedExample:
            "Eight lanes hold 1, 2, 3, 4, 5, 6, 7, 8. Offset 4 gives lane 0 = 1+5 = 6 and lane 1 = 2+6 = 8. Offset 2 gives lane 0 = 6+3+7 = 16. Offset 1 gives lane 0 = 16 + (4+8) = 36, which is the sum of 1 through 8.",
    },
    id: "warp-shuffle-reduction",
    name: "Warp Shuffle Reduction",
    category: "parallel-distributed",
    complexity: { time: "O(log lanes)", space: "O(lanes)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6, 7, 8], lanes: 8 },
    visualType: "array",
    run,
    pseudocode: [
        "load one value per lane into its register",
        "set the shuffle offset to half the lane count",
        "each lane below the offset adds the value offset lanes away",
        "halve the offset and repeat until it reaches zero",
        "lane zero now holds the sum of all lanes",
        "report the offsets used and the final result",
        "done: return the reduced value from lane zero",
    ],
};

export default module;

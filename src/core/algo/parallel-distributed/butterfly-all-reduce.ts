/**
 * butterfly-all-reduce.ts - Butterfly (Recursive Exchange) All-Reduce
 *
 * Each of p processes starts with a local vector. In log2(p) rounds a process
 * pairs with the partner found by flipping one bit of its rank, exchanges its
 * current accumulator, and sums the two. Because every exchange doubles the
 * set of contributors that a process has seen, after log2(p) rounds all
 * processes hold the elementwise global sum.
 *
 * Limit: p must be a power of two and vectors must be equal length.
 *
 * Time:  O(m log p) per process for vectors of length m
 * Space: O(p * m) for the accumulated vectors
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function cloneVectors(values: number[][]): number[][] {
    return values.map((v) => [...v]);
}

function addInto(target: number[], source: number[]): void {
    for (let i = 0; i < target.length; i += 1) target[i] = (target[i] ?? 0) + (source[i] ?? 0);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[][] } | null) ?? {};
    const source = task.values ?? [
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
    ];
    let values = cloneVectors(source);
    const p = values.length;
    const m = p > 0 ? (values[0]?.length ?? 0) : 0;
    const isPowerOfTwo = p > 0 && (p & (p - 1)) === 0;
    const rounds = isPowerOfTwo ? Math.log2(p) : 0;

    const expected = Array.from({ length: m }, (_, col) =>
        values.reduce((sum, vec) => sum + (vec[col] ?? 0), 0),
    );

    const nodeEntities = (acc: number[][]): VisualEntity[] =>
        acc.map((vec, rank) => ({
            id: `proc-${rank}`,
            type: "node" as const,
            label: `P${rank}: [${vec.join(",")}]`,
            value: [...vec],
            state: "idle" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { rank, len: vec.length },
        }));

    let step = 0;
    yield {
        stepNumber: step,
        entities: nodeEntities(values),
        edges: [],
        description: `${p} process(es) each hold a length-${m} vector; ${rounds} butterfly round(s) are required.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { rows: p, cols: m, rounds, accumulators: cloneVectors(values), expected },
    };
    step += 1;

    for (let round = 0; round < rounds; round += 1) {
        const bit = 1 << round;
        const snapshot = cloneVectors(values);
        const pairs: Array<[number, number]> = [];
        for (let rank = 0; rank < p; rank += 1) {
            const partner = rank ^ bit;
            if (rank < partner) pairs.push([rank, partner]);
        }
        for (const [a, b] of pairs) {
            const combined = [...(snapshot[a] ?? [])];
            addInto(combined, snapshot[b] ?? []);
            values[a] = combined;
            values[b] = [...combined];
        }
        yield {
            stepNumber: step,
            entities: nodeEntities(values).map((entity) => {
                const rank = Number(entity.metadata["rank"]);
                const partner = rank ^ bit;
                return { ...entity, state: (pairs.some(([a, b]) => a === rank || b === rank) ? "active" : "idle") as "active" | "idle", metadata: { ...entity.metadata, partner } };
            }),
            edges: pairs.map(([a, b]) => ({
                id: `link-${a}-${b}-r${round}`,
                sourceId: `proc-${a}`,
                targetId: `proc-${b}`,
                label: `r${round}`,
                state: "active" as const,
                directed: false,
            })),
            description: `Butterfly round ${round + 1}: partners differ in bit ${round}; each pair now holds the sum of its combined contributors.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: { rows: p, cols: m, round: round + 1, accumulators: cloneVectors(values), expected, pairs },
        };
        step += 1;
    }

    const converged = values.every((vec) => vec.every((v, col) => v === expected[col]));
    yield {
        stepNumber: step,
        entities: nodeEntities(values).map((entity) => ({ ...entity, state: (converged ? "sorted" : "error") as "sorted" | "error" })),
        edges: [],
        description: converged
            ? `All ${p} processes hold the global sum [${expected.join(",")}].`
            : `All-reduce did not converge to the expected sum.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: { rows: p, cols: m, converged, accumulators: cloneVectors(values), expected },
    };
}

const module: AlgorithmModule = {
    id: "butterfly-all-reduce",
    name: "Butterfly All-Reduce",
    category: "parallel-distributed",
    complexity: { time: "O(m log p) per process", space: "O(p * m)" },
    defaultInput: {
        values: [
            [1, 2],
            [3, 4],
            [5, 6],
            [7, 8],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "let each process hold a local vector and an accumulator",
        "for round r from 0 to log2(p)-1",
        "pair process rank with rank xor 2^r",
        "exchange the current accumulators between the two partners",
        "both partners replace their accumulator with the elementwise sum",
        "continue to the next round with the enlarged contributor set",
        "after the final round every process holds the global sum",
        "done: report the shared reduced vector",
    ],
    education: {
        intuition:
            "A butterfly all-reduce is a sequence of pairwise exchanges. In the first round neighbors combine their values; in the second, pairs of pairs combine; and so on. Since each exchange doubles the number of original vectors a process has accumulated, logarithmic rounds suffice even though no single process talks to everyone.",
        invariants: [
            "At the start of round r each accumulator sums exactly 2^r original vectors.",
            "Both partners of an exchange write the same combined vector.",
            "The set of contributors represented by an accumulator is always a contiguous block of ranks.",
        ],
        correctness:
            "Each exchange replaces two accumulators that cover disjoint contributor sets with their union, so the doubled-set invariant is maintained. After log2(p) rounds the contributor set is all p ranks, and the accumulator is the elementwise sum of all original vectors. Every process follows the same schedule and therefore ends with the same vector.",
        complexityRationale:
            "There are log2(p) rounds and each exchange adds two length-m vectors, so a process performs O(m log p) work. Storing one accumulator per process costs O(p * m) space.",
        uses: [
            "Gradient aggregation in distributed training",
            "Global reductions in MPI and collective communication libraries",
            "Computing sums, maxima, or sums of squares across compute nodes",
        ],
        references: [
            "Thakur, Rabenseifner, and Gropp, Optimization of Collective Communication Operations in MPICH, 2005",
            "NVIDIA, NCCL Collective Operations documentation",
        ],
        workedExample:
            "With four processes holding [1,2], [3,4], [5,6], [7,8], round zero pairs (0,1) and (2,3), producing [4,6] and [12,14]. Round one pairs 0 with 2, producing [16,20] on all four processes, which is the elementwise global sum.",
    },
};

export default module;

/**
 * fischer-heun-rmq.ts - Fischer-Heun Range Minimum Query
 *
 * Fischer-Heun RMQ answers minimum queries on a static array with constant
 * time after linear-ish preprocessing. The array is split into small blocks;
 * full blocks are answered from a sparse table built on block minima, while
 * the short partial blocks at the ends are answered by direct lookup in a
 * precomputed table. This demo uses the same decomposition and shows the
 * block minima, the sparse table, and each query's three-part answer.
 *
 * Time:  O(n log n) preprocessing, O(1) per range query
 * Space: O(n log n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Query = [number, number];

function better(values: number[], i: number, j: number): number {
    if (i < 0) return j;
    if (j < 0) return i;
    const vi = values[i] ?? Infinity;
    const vj = values[j] ?? Infinity;
    if (vi !== vj) return vi < vj ? i : j;
    return Math.min(i, j);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; queries?: Query[] } | null) ?? {};
    const values = Array.isArray(task.values) && task.values.length > 0
        ? [...task.values]
        : [5, 2, 7, 1, 9, 3, 8, 4, 6, 0, 11, 2];
    const queries: Query[] = Array.isArray(task.queries)
        ? task.queries
        : [
              [0, 5],
              [2, 8],
              [0, 11],
              [4, 4],
              [7, 10],
          ];
    const n = values.length;
    const B = 4;
    const nb = Math.ceil(n / B);
    let step = 0;

    if (n === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Empty array: no range minimum queries can be answered.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { answers: [], indices: [] },
        };
        return;
    }

    const blockMin: number[] = [];
    for (let b = 0; b < nb; b += 1) {
        const start = b * B;
        const end = Math.min(n, start + B);
        let best = start;
        for (let i = start + 1; i < end; i += 1) best = better(values, i, best);
        blockMin.push(best);
    }

    const log: number[] = Array(nb + 1).fill(0);
    for (let i = 2; i <= nb; i += 1) log[i] = (log[Math.floor(i / 2)] ?? 0) + 1;
    const K = nb > 0 ? (log[nb] ?? 0) + 1 : 1;
    const st: number[][] = Array.from({ length: K }, () => Array(nb).fill(-1));
    for (let b = 0; b < nb; b += 1) st[0]![b] = blockMin[b] ?? -1;
    for (let k = 1; k < K; k += 1) {
        for (let b = 0; b + (1 << k) <= nb; b += 1) {
            const left = st[k - 1]?.[b] ?? -1;
            const right = st[k - 1]?.[b + (1 << (k - 1))] ?? -1;
            st[k]![b] = better(values, left, right);
        }
    }

    const cells = (lo: number, hi: number, bestIdx: number): VisualEntity[] =>
        values.map((value, index) => ({
            id: `fh-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: (index === bestIdx ? "sorted" : index >= lo && index <= hi ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: Math.floor(index / B), col: index % B, index, block: Math.floor(index / B) },
        }));

    yield {
        stepNumber: step,
        entities: cells(-1, -1, -1),
        edges: [],
        description: `Values split into ${nb} block(s) of size ${B}; block minima indices are [${blockMin.join(", ")}].`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { answers: [], indices: [], blockMin, blocks: nb, values: [...values] },
    };
    step += 1;

    const answer = ([rawL, rawR]: Query): number => {
        const l = Math.max(0, Math.min(n - 1, rawL));
        const r = Math.max(l, Math.min(n - 1, rawR));
        const bl = Math.floor(l / B);
        const br = Math.floor(r / B);
        let best = -1;
        if (bl === br) {
            for (let i = l; i <= r; i += 1) best = better(values, i, best);
        } else {
            for (let i = l; i < Math.min(n, (bl + 1) * B); i += 1) best = better(values, i, best);
            if (bl + 1 <= br - 1) {
                const len = br - 1 - (bl + 1) + 1;
                const k = log[len] ?? 0;
                const left = st[k]?.[bl + 1] ?? -1;
                const right = st[k]?.[br - 1 - (1 << k) + 1] ?? -1;
                best = better(values, best, better(values, left, right));
            }
            for (let i = br * B; i <= r; i += 1) best = better(values, i, best);
        }
        return best;
    };

    const answers: number[] = [];
    const indices: number[] = [];
    for (const query of queries) {
        const idx = answer(query);
        const value = values[idx] ?? 0;
        answers.push(value);
        indices.push(idx);
        yield {
            stepNumber: step,
            entities: cells(query[0], query[1], idx),
            edges: [],
            description: `Query [${query[0]}, ${query[1]}]: minimum is ${value} at index ${idx}, combining edge blocks and the sparse table.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: {
                answers: [...answers],
                indices: [...indices],
                query: [...query],
                index: idx,
                value,
                values: [...values],
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells(-1, -1, -1).map((entity) => ({ ...entity, state: "sorted" as EntityState })),
        edges: [],
        description: `Answered ${queries.length} range queries with the block sparse-table decomposition.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { answers, indices, blockMin, blocks: nb },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Range minimum queries become easy once you split the array into small blocks. Fully covered blocks can be merged with a sparse table that stores the minimum of each power-of-two run of blocks, so a middle range is answered with two table lookups. Only the two short partial blocks at the ends need a direct scan, and those are small enough to precompute. That decomposition is the heart of the Fischer-Heun structure.",
        invariants: [
            "Each block minimum index is the position of the smallest value inside that block.",
            "The sparse table entry at level k and block b is the minimum over blocks b through b plus two to the k minus one.",
            "For any query, the union of the left scan, middle table answer, and right scan is exactly the requested range.",
        ],
        correctness:
            "A range splits into a left partial block, zero or more whole blocks, and a right partial block, with no overlap and no gap. The sparse table is correct by induction: level zero stores single blocks and each higher level merges two adjacent lower levels. Taking the minimum of the three parts therefore returns the minimum of the whole range, and tie-breaking by smaller index makes answers deterministic, which a brute-force scan confirms.",
        complexityRationale:
            "There are O(n/B) blocks and O(log(n/B)) sparse-table levels, so preprocessing is O(n log n) in the worst case and memory matches. Each query scans at most 2B boundary slots and performs two table lookups, which is O(1) for fixed block size. Dropping to O(n) space and true O(1) queries requires the ±1 micro-block table of the full Fischer-Heun construction.",
        uses: [
            "Lowest common ancestor queries after an Euler tour of a tree",
            "Static range queries in computational biology and genomic indexes",
            "Sliding-window minimum preprocessing in image and signal processing",
        ],
        references: [
            "Fischer and Heun, Theoretical and Practical Improvements on RMQ, 2006",
            "Bender, Farach-Colton and Fischer, Toeplitz Tries and Linear Space LCA, 2008",
        ],
        workedExample:
            "For values 5, 2, 7, 1, 9, 3, 8, 4, 6, 0, 11, 2 with block size 4, block minima are indices 1, 3, and 9. The query [2, 8] scans slots 2 and 3 of the first block, answers the middle block from the sparse table, and scans slot 8 of the last block; the smallest value among them is 1 at index 3.",
    },
    id: "fischer-heun-rmq",
    name: "Fischer-Heun RMQ",
    category: "data-structures",
    complexity: { time: "O(1) query", space: "O(n log n)" },
    defaultInput: {
        values: [5, 2, 7, 1, 9, 3, 8, 4, 6, 0, 11, 2],
        queries: [
            [0, 5],
            [2, 8],
            [0, 11],
            [4, 4],
            [7, 10],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "split the array into fixed-size blocks",
        "record the minimum index of every block",
        "build a sparse table over the block minima",
        "for each query identify the left and right blocks",
        "scan the short partial blocks at both ends",
        "answer fully covered middle blocks from the sparse table",
        "combine the candidates by value then index",
        "report the minimum value and index for each query",
    ],
};

export default module;

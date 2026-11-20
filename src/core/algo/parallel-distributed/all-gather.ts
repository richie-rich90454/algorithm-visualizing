/**
 * all-gather.ts - Recursive Doubling All-Gather
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In an all-gather, p processes each start with one chunk of data and every
 * process must end with all p chunks concatenated in rank order. Recursive
 * doubling does this in log(p) rounds. In round k each process exchanges the
 * set of chunks it currently holds with the partner whose rank differs in bit
 * k, then merges the two sets by rank. After the last round every process holds
 * every chunk, so each can assemble the identical full buffer in rank order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log p) rounds with O(m) data exchanged per round
 *   Space: O(p + m) per process for its chunk set and assembled buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid rows are processes; columns are chunk ranks.
 *   - A filled cell means that process currently holds that rank's chunk.
 *   - GREEN marks a newly received chunk; meta.buffers is each full buffer.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    chunks?: number[][];
}

const defaultChunks: number[][] = [[1, 2], [3, 4], [5, 6], [7, 8]];

function makeCells(held: boolean[][], fresh: number): VisualEntity[] {
    const p = held.length;
    const entities: VisualEntity[] = [];
    for (let r = 0; r < p; r += 1) {
        for (let c = 0; c < p; c += 1) {
            const has = held[r]![c] ?? false;
            const state: EntityState = has ? (c === fresh ? "active" : "sorted") : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: has ? String(c) : "-",
                value: has ? 1 : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, held: has, chunkRank: c },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    let chunks: number[][] = Array.isArray(task.chunks) && task.chunks.length >= 2
        ? task.chunks.map((c) => [...(c ?? [])])
        : defaultChunks.map((c) => [...c]);
    const p = chunks.length;
    const held: boolean[][] = Array.from({ length: p }, () => Array.from({ length: p }, () => false));
    for (let r = 0; r < p; r += 1) held[r]![r] = true;

    const buffers = (): number[][] => held.map((row) => row.flatMap((has, rank) => (has ? (chunks[rank] ?? []) : [])));
    let step = 0;
    const meta = (round: number, fresh: number, last: string) => ({
        processes: p,
        rows: p,
        cols: p,
        round,
        chunks: chunks.map((c) => c.join(",")),
        buffers: buffers().map((b) => b.join(",")),
        fresh,
        last,
    });

    yield {
        stepNumber: step++,
        entities: makeCells(held, -1),
        edges: [],
        description: `All-gather on ${p} processes; each starts with its own chunk of ${p} rank(s) total.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, -1, "initialized"),
    };

    for (let bit = 1; bit < p; bit *= 2) {
        const freshRanks: number[] = [];
        for (let r = 0; r < p; r += 1) {
            const partner = r ^ bit;
            for (let rank = 0; rank < p; rank += 1) {
                if (held[partner]![rank] && !held[r]![rank]) {
                    held[r]![rank] = true;
                    freshRanks.push(rank);
                }
            }
        }
        const uniqueFresh = [...new Set(freshRanks)];
        const desc = `Round bit ${bit}: exchange held chunks with each rank-differing partner; ${uniqueFresh.length} rank(s) newly learned.`;
        yield {
            stepNumber: step++,
            entities: makeCells(held, uniqueFresh[0] ?? -1),
            edges: [],
            description: desc,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(bit, uniqueFresh[0] ?? -1, desc),
        };
    }

    const expected = chunks.flat();
    const allHaveAll = held.every((row) => row.every(Boolean));
    const allBuffersEqual = buffers().every((buf) => buf.length === expected.length && buf.every((v, i) => v === expected[i]));
    const done = allHaveAll && allBuffersEqual
        ? `All ${p} processes hold every chunk and assemble the identical buffer [${expected.join(", ")}] in rank order.`
        : `All-gather incomplete: check that the process count is a power of two.`;
    yield {
        stepNumber: step,
        entities: makeCells(held, -1),
        edges: [],
        description: done,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...meta(p, -1, done), complete: allHaveAll && allBuffersEqual },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Everyone begins knowing only their own piece. In each round, pair up with the process whose number differs in the next binary digit and trade everything you know. After the first round two processes know two pieces, after the next four know four, and so on. Because the exchange is by rank, every process can lay the pieces out in order and end up with the same complete buffer.",
        invariants: [
            "After round k each process holds exactly the chunks whose rank shares its low k bits pattern.",
            "A process only ever learns chunks it did not already have.",
            "Merging is by rank, so the assembled buffer order is identical everywhere.",
        ],
        correctness:
            "At bit position b, a process with rank r pairs with r xor 2^b. By induction after processing bits 1, 2, 4, ..., a process holds every chunk whose rank differs from r only in bits already processed, so the held set doubles each round. After log(p) rounds with p a power of two, all p chunks are held by every process. Because each chunk is placed at its own rank index, assembling in rank order yields the concatenation of chunks 0 through p-1 at every process, which is exactly the all-gather result.",
        complexityRationale:
            "There are log(p) rounds and each exchange sends the currently held chunks, O(m) data per round where m is the total data size, giving O(m log p) communication per process. Each process stores its held chunk set and the assembled buffer, O(p + m) space.",
        uses: [
            "Distributing parameters and gradients in data-parallel training",
            "Gathering partial results in scientific simulation",
            "Collective communication in MPI and distributed array libraries",
        ],
        references: [
            "Gropp, Lusk, and Skjellum, Using MPI, chapter on collective operations",
            "Thakur, Rabenseifner, and Gropp, Optimization of Collective Communication Operations in MPICH, 2005",
        ],
        workedExample:
            "Four processes start with chunks A, B, C, D. In the first round ranks 0 and 1 swap so both know A and B, and ranks 2 and 3 swap so both know C and D. In the second round rank 0 trades with 2 and rank 1 with 3, so everyone holds A, B, C, D and assembles the same buffer A+B+C+D.",
    },
    id: "all-gather",
    name: "Recursive Doubling All-Gather",
    category: "parallel-distributed",
    complexity: { time: "O(m log p)", space: "O(p + m)" },
    defaultInput: { chunks: defaultChunks },
    visualType: "grid",
    run,
    pseudocode: [
        "each process starts holding only its own chunk",
        "for each bit position up to log of the process count",
        "pair with the rank whose bit at that position differs",
        "exchange the sets of chunks held with that partner",
        "merge the learned chunks using their rank as key",
        "continue until every chunk is held everywhere",
        "assemble chunks in rank order into one buffer",
        "done: report the identical full buffer",
    ],
};

export default module;

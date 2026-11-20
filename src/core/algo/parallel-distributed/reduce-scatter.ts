/**
 * reduce-scatter.ts - Recursive-Halving Reduce-Scatter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Each of p processes starts with one contribution per target process. In
 * log2(p) rounds, processes pair with the peer obtained by flipping one bit of
 * their rank, exchange half of their buffer, and add what they receive. After
 * the last round process r holds the sum of every process's contribution r.
 * This is the reduction phase of ring and recursive-doubling all-reduce.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p log p) per process for p chunks
 *   Space: O(p) per process for the shrinking buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Rows are processes, columns are the chunks still held in the buffer.
 *   - A round's partner exchange is drawn as a directed edge between rows.
 *   - The surviving chunk of each process turns GREEN in the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

const defaultData: number[][] = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
];

function makeCells(buffer: number[][], states: Map<string, EntityState> = new Map()): VisualEntity[] {
    return buffer.flatMap((row, r) =>
        row.map((value, c) => ({
            id: `cell-${r}-${c}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: states.get(`${r}-${c}`) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: r, col: c },
        })),
    );
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { data?: number[][] } | null) ?? {};
    const raw = Array.isArray(task.data) && task.data.length > 0 ? task.data : defaultData;
    let size = raw.length;
    while ((size & (size - 1)) !== 0) {
        size -= 1;
    }
    size = Math.max(2, size);
    const data = raw.slice(0, size).map((row) => {
        const values = Array.isArray(row) ? row : [];
        return Array.from({ length: size }, (_, c) => Number(values[c]) || 0);
    });

    let buffer = data.map((row) => [...row]);
    let step = 0;
    let messages = 0;

    const frame = (
        description: string,
        codeLineNumber: number,
        states: Map<string, EntityState> = new Map(),
        edges: VisualEdge[] = [],
        round = 0,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(buffer, states),
        edges,
        description,
        codeLineNumber,
        layout: "grid",
        meta: {
            rows: buffer.length,
            cols: buffer[0]?.length ?? 0,
            round,
            messages,
            result: buffer.map((row) => row[0] ?? 0),
        },
    });

    yield frame(`Reduce-scatter across ${size} processes; each starts with ${size} contribution(s).`, 0);

    let span = size;
    let round = 0;
    while (span > 1) {
        const half = span / 2;
        round += 1;
        const edges: VisualEdge[] = [];
        const highlighted = new Map<string, EntityState>();
        for (let r = 0; r < size; r += 1) {
            const partner = r ^ half;
            const keepLow = r % span < half;
            const from = keepLow ? half : 0;
            const to = keepLow ? span : half;
            for (let c = from; c < to; c += 1) {
                highlighted.set(`${r}-${c}`, "comparing");
            }
            edges.push({
                id: `exchange-${round}-${r}`,
                sourceId: `cell-${r}-${from}`,
                targetId: `cell-${partner}-${from}`,
                label: keepLow ? "send high" : "send low",
                state: "active",
                directed: true,
            });
        }
        messages += size;
        yield frame(
            `Round ${round}: every process flips bit ${Math.log2(half)} of its rank, swaps half its buffer with its partner, and adds the received values.`,
            1,
            highlighted,
            edges,
            round,
        );

        buffer = buffer.map((row, r) => {
            const partner = r ^ half;
            const keepLow = r % span < half;
            const kept = keepLow ? row.slice(0, half) : row.slice(half, span);
            const incoming = keepLow
                ? (buffer[partner] ?? []).slice(0, half)
                : (buffer[partner] ?? []).slice(half, span);
            return kept.map((value, i) => value + (incoming[i] ?? 0));
        });
        yield frame(
            `After round ${round} each process holds ${half} reduced chunk(s); ${buffer[0]?.length ?? 0} column(s) remain.`,
            3,
            new Map(),
            [],
            round,
        );
        span = half;
    }

    const finalStates = new Map<string, EntityState>();
    for (let r = 0; r < size; r += 1) {
        finalStates.set(`${r}-0`, "sorted");
    }
    yield frame(
        `Reduce-scatter complete after ${round} round(s) and ${messages} message(s); process r now holds the sum of column r across all processes.`,
        5,
        finalStates,
        [],
        round,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a table whose rows are processes and whose columns name the destination of each number. In each round, two processes whose ranks differ in one bit trade one half of the table and add what they receive. Halving the table every round means that after log2(p) rounds a process keeps exactly one column, and that column contains the sum from every row.",
        invariants: [
            "After each round, a surviving column holds the sum of the matching columns of all processes in the same group.",
            "The buffer halves in width every round while the number of processes stays p.",
            "Partners are paired by one flipped rank bit, so every exchange is disjoint.",
        ],
        correctness:
            "At round k, processes are grouped by the high bits of their ranks; within a group of size s, flipping bit s/2 pairs two processes whose buffers cover complementary sets of contributing processes. Adding the received half makes each kept column cover the union of the pair's contributors. By induction over halving rounds, a surviving column after log2(p) rounds covers all p contributors, so process r holds the sum of every process's contribution r.",
        complexityRationale:
            "There are log2(p) rounds, each moving O(p) values per process, giving O(p log p) work per process and O(p^2 log p) total. The buffer shrinks each round, so a process never stores more than O(p) values.",
        uses: [
            "The reduction phase of all-reduce in distributed training",
            "Aggregating per-shard gradients so each worker owns one parameter block",
            "Parallel prefix and suffix computations on distributed arrays",
        ],
        references: [
            "MPI Forum, MPI: A Message-Passing Interface Standard, collective operations",
            "Barnett et al., A Message-Passing Interface Standard and Its Implementations, 1994",
        ],
        workedExample:
            "With four processes holding columns [1,2,3,4], [5,6,7,8], [9,10,11,12], and [13,14,15,16], round one pairs 0 with 2 and 1 with 3. Round two pairs 0 with 1 and 2 with 3. Process 0 ends with column 0 summed to 28, process 1 with 32, process 2 with 36, and process 3 with 40.",
    },
    id: "reduce-scatter",
    name: "Recursive-Halving Reduce-Scatter",
    category: "parallel-distributed",
    complexity: { time: "O(p log p) per process", space: "O(p) per process" },
    defaultInput: { data: defaultData },
    visualType: "grid",
    run,
    pseudocode: [
        "let each process hold p numbered contributions",
        "for round from 1 to log2(p)",
        "pair each rank with the peer obtained by flipping one bit",
        "exchange the half of the buffer selected by that bit",
        "add the received half into the half you kept",
        "discard the half you sent and halve the buffer width",
        "repeat until one contribution per process remains",
        "done: process r holds the sum of column r over all processes",
    ],
};

export default module;

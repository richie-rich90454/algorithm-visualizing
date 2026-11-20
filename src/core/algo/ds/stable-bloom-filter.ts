/**
 * stable-bloom-filter.ts - Stable Bloom Filter
 *
 * Unlike a counting or scalable Bloom filter, a stable Bloom filter tracks a
 * sliding window of recent insertions using monotonically growing timestamps
 * in a fixed array of cells. Insertions stamp k hashed cells with the current
 * generation; a rotating pointer clears cells whose stamp has aged out of the
 * window. A query is positive only when all k cells still carry live stamps,
 * so recent elements are never false negatives.
 *
 * Time:  O(k) insert and query; Space: O(m)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[]; queries?: number[]; m?: number; window?: number } | null) ?? {};
    const inserts = task.inserts ?? [3, 7, 11, 3, 15, 21, 7, 30];
    const queries = task.queries ?? [3, 7, 99, 21, 30, 50];
    const m = typeof task.m === "number" ? Math.max(8, task.m) : 24;
    const window = typeof task.window === "number" ? Math.max(1, task.window) : 5;
    const k = 3;

    const cells = new Array<number>(m).fill(0);
    const hashes = (x: number): number[] => {
        const v = Math.abs(Math.trunc(x)) + 1;
        return [v * 3 + 1, v * 5 + 7, v * 7 + 11].map((h) => (h * 2654435761) % m);
    };

    let generation = 0;
    let pointer = 0;
    let step = 0;
    const queryResults: boolean[] = [];

    const frame = (message: string, line: number, hot: number, result?: boolean): VisualFrame => {
        const entities: VisualEntity[] = cells.map((stamp, i) => ({
            id: `cell-${i}`,
            type: "bar" as const,
            label: stamp === 0 ? "-" : String(stamp),
            value: stamp,
            state: (i === hot ? "active" : stamp !== 0 && generation - stamp <= window ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, live: stamp !== 0 && generation - stamp <= window },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "array",
            meta: {
                cells: cells.slice(),
                generation,
                pointer,
                window,
                inserts: inserts.length,
                queryResults: queryResults.map((value) => (value ? 1 : 0)),
                lastResult: result === undefined ? "n/a" : result,
            },
        };
    };

    yield frame(`Empty stable filter: ${m} cells with a window of ${window} generations.`, 0, -1);
    step += 1;

    for (const value of inserts) {
        generation += 1;
        const positions = hashes(value);
        for (const idx of positions) cells[idx] = generation;
        pointer = (pointer + 1) % m;
        if (cells[pointer] !== 0 && generation - cells[pointer]! > window) cells[pointer] = 0;
        yield frame(
            `Insert ${value}: stamp cells [${positions.join(", ")}] with generation ${generation}.`,
            1,
            positions[0] ?? 0,
        );
        step += 1;
    }

    for (const value of queries) {
        const positions = hashes(value);
        const present = positions.every((idx) => cells[idx] !== 0 && generation - cells[idx]! <= window);
        queryResults.push(present);
        yield frame(`Query ${value}: all ${k} hashed cells live? ${present}.`, 2, positions[0] ?? 0, present);
        step += 1;
    }

    yield frame(
        `Done: ${inserts.length} inserts, ${queries.length} queries, generation ${generation}.`,
        3,
        -1,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A stable Bloom filter remembers only recent insertions. It stores a timestamp in each cell instead of a plain bit, stamping several cells when a value arrives. A rotating cursor clears cells that are older than the sliding window, so the fixed-size memory always reflects a recent sample of the stream and old entries quietly fade away.",
        invariants: [
            "Every stamped cell holds the generation of its most recent insertion.",
            "A cell is live when the current generation minus its stamp is at most the window.",
            "Only cells older than the window are cleared by the rotating pointer.",
        ],
        correctness:
            "When a value is inserted, all k of its cells receive the newest generation, so within the next window generations every one of those cells is still live unless a later insertion overwrote it with an even newer stamp. Hence a query for any recently inserted value returns true: there are no false negatives inside the window. Older values may linger as false positives, which is the accepted trade-off.",
        complexityRationale:
            "Each insert stamps k cells and advances one pointer, and each query reads k cells, so both are O(k) independent of the number of stored items. The cell array has fixed size m, giving O(m) space and a bounded false-positive rate controlled by m, k, and the window.",
        uses: [
            "Duplicate suppression in stream processing",
            "Recent-event detection in network monitors",
            "Caching and crawler frontier deduplication",
        ],
        references: [
            "Deng and Rafiei, Approximately Detecting Duplicates for Streaming Data, 2006",
            "Bloom, Space/Time Trade-offs in Hash Coding with Allowable Errors, 1970",
        ],
        workedExample:
            "With a window of five, inserting 3 at generation one stamps its three cells with 1. Inserting 7 at generation two stamps a different set with 2. Querying 3 immediately sees three live cells and returns true; after the generation passes six, those cells have aged out and the query may return false, reflecting that 3 is no longer recent.",
    },
    id: "stable-bloom-filter",
    name: "Stable Bloom Filter",
    category: "data-structures",
    complexity: { time: "O(k)", space: "O(m)" },
    defaultInput: {
        inserts: [3, 7, 11, 3, 15, 21, 7, 30],
        queries: [3, 7, 99, 21, 30, 50],
        m: 24,
        window: 5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize m cells to zero and generation to zero",
        "for each inserted value increment the generation",
        "stamp k hashed cells with the new generation",
        "advance the rotating pointer by one cell",
        "clear the pointed cell if its stamp aged out",
        "query: report present only if all k cells are live",
        "done: report insert count and query answers",
    ],
};

export default module;

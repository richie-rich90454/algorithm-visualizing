/**
 * lsm-tree-compaction.ts - Log-Structured Merge Tree Compaction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An LSM tree absorbs writes by appending sorted runs (SSTables) to level zero
 * rather than updating pages in place. When too many level-zero files pile up,
 * compaction merges them into a single larger sorted run in the next level.
 * During the merge, later versions of a key overwrite earlier ones, so a lookup
 * needs to consult only the newest surviving value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(total entries * log number of runs) per compaction
 *   Space: O(total entries) for the merged run
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero holds level-zero SSTables; row one holds the compacted level.
 *   - Each cell is an SSTable labeled with its key range and entry count.
 *   - The table being created by a compaction is highlighted green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Entry = [number, string];
type Table = { entries: Entry[] };
type Pair = [number, string];

/** Convert input pairs into a normalized sorted table. */
function toTable(pairs: Pair[]): Table {
    const entries = pairs
        .map((pair): Entry => [Number(pair[0]), String(pair[1])])
        .sort((a, b) => a[0] - b[0]);
    return { entries };
}

/** Merge tables in oldest-to-newest order, keeping the last value for each key. */
function mergeTables(tables: Table[]): Table {
    const map = new Map<number, string>();
    for (const table of tables) {
        for (const [key, value] of table.entries) {
            map.set(key, value);
        }
    }
    return { entries: [...map.entries()].sort((a, b) => a[0] - b[0]) };
}

/** Render one frame of level-zero and compacted tables. */
function makeCells(level0: Table[], level1: Table | null, highlight: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    level0.forEach((table, col) => {
        const first = table.entries[0]?.[0] ?? -1;
        const last = table.entries[table.entries.length - 1]?.[0] ?? -1;
        entities.push({
            id: `l0-${col}`,
            type: "cell" as const,
            label: `${first}..${last} (${table.entries.length})`,
            value: table.entries.length,
            state: "comparing" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col, count: table.entries.length },
        });
    });
    if (level1) {
        const first = level1.entries[0]?.[0] ?? -1;
        const last = level1.entries[level1.entries.length - 1]?.[0] ?? -1;
        entities.push({
            id: "l1-0",
            type: "cell" as const,
            label: `${first}..${last} (${level1.entries.length})`,
            value: level1.entries.length,
            state: (highlight ? "sorted" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: 0, count: level1.entries.length },
        });
    }
    return entities;
}

/** The LSM compaction generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { runs?: Pair[][]; threshold?: number } | null) ?? {};
    const runs: Pair[][] = Array.isArray(task.runs) && task.runs.length > 0
        ? task.runs
        : [
            [[1, "a"], [3, "c"], [5, "e"]],
            [[2, "b"], [4, "d"], [6, "f"]],
            [[3, "C"], [5, "E"], [7, "g"]],
            [[1, "A"], [8, "h"], [9, "i"]],
            [[2, "B"], [4, "D"], [10, "j"]],
        ];
    const threshold = typeof task.threshold === "number" ? Math.max(2, Math.floor(task.threshold)) : 2;

    let level0: Table[] = [];
    let level1: Table | null = null;
    let compactions = 0;
    const metaBase = (
        highlight: boolean,
    ): VisualFrame["meta"] => ({
        rows: 2,
        cols: Math.max(1, level0.length + (level1 ? 1 : 0)),
        l0Count: level0.length,
        l1Count: level1 ? 1 : 0,
        compactions,
        visibleKeys: mergeTables([...(level1 ? [level1] : []), ...level0]).entries.map(([key]) => key),
        visibleValues: mergeTables([...(level1 ? [level1] : []), ...level0]).entries.map(([, value]) => value),
        highlight,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(level0, level1, false),
        edges: [],
        description: `LSM tree ready: flushing up to ${runs.length} sorted runs, compacting every ${threshold} level-zero files.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaBase(false),
    };
    let step = 1;

    for (let i = 0; i < runs.length; i += 1) {
        level0 = [...level0, toTable(runs[i] as Pair[])];
        yield {
            stepNumber: step,
            entities: makeCells(level0, level1, false),
            edges: [],
            description: `Flushed run ${i + 1} into level zero; ${level0.length} file(s) waiting to be compacted.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: metaBase(false),
        };
        step += 1;

        if (level0.length >= threshold) {
            const sources = [...(level1 ? [level1] : []), ...level0];
            level1 = mergeTables(sources);
            level0 = [];
            compactions += 1;
            yield {
                stepNumber: step,
                entities: makeCells(level0, level1, true),
                edges: [],
                description: `Compaction ${compactions}: merged ${sources.length} run(s) into one sorted run of ${level1.entries.length} live key(s) in level one.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: metaBase(true),
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(level0, level1, false),
        edges: [],
        description: `Write stream complete: ${level0.length} level-zero file(s), ${compactions} compaction(s), ${(level1?.entries.length ?? 0) + level0.reduce((a, t) => a + t.entries.length, 0)} stored entries.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: metaBase(false),
    };
}

/** The LSM tree compaction module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Writing directly into a balanced tree causes many scattered disk writes. An LSM tree instead writes each batch as a new sorted file, which is fast because it is sequential. Background compaction periodically merges several small sorted files into a larger one, throwing away overwritten versions so reads stay efficient.",
        invariants: [
            "Every SSTable's entries are sorted by key.",
            "Level-zero files are ordered from oldest to newest.",
            "A compaction keeps only the newest value for each key.",
        ],
        correctness:
            "A lookup must return the most recently written value for a key. Merging sources in oldest-to-newest order into a map overwrites each key with every newer version in turn, so the final map holds exactly the latest value. Sorting the map's entries produces a valid SSTable, and because no older source remains after compaction, future reads see the same answer as the original write stream.",
        complexityRationale:
            "Compaction reads each entry from every source once and writes one sorted run; using a heap or a sorted k-way merge costs O(total entries times log number of runs). Storing the merged run and the level-zero hold area uses O(total entries) space.",
        uses: [
            "Storage engines such as LevelDB, RocksDB, and Cassandra",
            "Write-heavy key-value stores and time-series databases",
            "Log-structured file systems and ingest pipelines",
        ],
        references: [
            "O'Neil et al., The Log-Structured Merge-Tree, 1996",
            "RocksDB Wiki, Leveled Compaction, 2026",
        ],
        workedExample:
            "Flushing runs [1:a, 3:c] and [2:b, 3:C] creates two level-zero files. Compacting them merges by key: key 1 keeps a, key 2 keeps b, and key 3 keeps C because the second run is newer, leaving one sorted run [1:a, 2:b, 3:C].",
    },
    id: "lsm-tree-compaction",
    name: "LSM Tree Compaction",
    category: "production-systems",
    complexity: { time: "O(total entries * log runs)", space: "O(total entries)" },
    defaultInput: {
        runs: [
            [[1, "a"], [3, "c"], [5, "e"]],
            [[2, "b"], [4, "d"], [6, "f"]],
            [[3, "C"], [5, "E"], [7, "g"]],
            [[1, "A"], [8, "h"], [9, "i"]],
            [[2, "B"], [4, "D"], [10, "j"]],
        ],
        threshold: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with empty level zero and level one",
        "for each incoming sorted write batch",
        "flush it as a new level-zero SSTable",
        "if level zero reaches the file threshold",
        "merge all level-zero files into level one, keeping newest values",
        "clear level zero after the merge",
        "done: report the live keys and compaction count",
    ],
};

export default module;

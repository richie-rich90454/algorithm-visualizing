/**
 * lsm-tree.ts – LSM Tree
 *
 * Writes land in a memtable; a full memtable flushes to an immutable
 * SSTable, and small tables compact into bigger ones. Reads check newest
 * first, so the demo lookup finds its key in L1.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const nonEmpty = (list: VisualEntity[]): VisualEntity[] =>
    list.length > 0
        ? list
        : [
              {
                  id: "empty-note",
                  type: "cell" as const,
                  label: "(empty)",
                  value: 0,
                  state: "idle" as EntityState,
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  metadata: { row: 0, col: 0 },
              },
          ];

const MEM_CAP = 2;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { puts?: Array<[string, number]>; get?: string } | null) ?? {};
    const puts = task.puts ?? [
        ["a", 1],
        ["b", 2],
        ["c", 3],
        ["d", 4],
    ];
    const get = task.get ?? "c";
    let step = 0;

    let mem = new Map<string, number>();
    const l0: Array<Map<string, number>> = [];
    let l1 = new Map<string, number>();

    const snap = (hot: string, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        let col = 0;
        for (const [k, v] of mem) {
            entities.push({
                id: `mem-${k}`,
                type: "cell" as const,
                label: `${k}=${v}`,
                value: v,
                state: (hot === `mem-${k}` ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col },
            });
            col += 1;
        }
        l0.forEach((t, ti) => {
            let c = 0;
            for (const [k, v] of t) {
                entities.push({
                    id: `l0-${ti}-${k}`,
                    type: "cell" as const,
                    label: `${k}=${v}`,
                    value: v,
                    state: (hot === `l0-${ti}-${k}` ? "sorted" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: 1 + ti, col: c },
                });
                c += 1;
            }
        });
        let c = 0;
        for (const [k, v] of l1) {
            entities.push({
                id: `l1-${k}`,
                type: "cell" as const,
                label: `${k}=${v}`,
                value: v,
                state: (hot === `l1-${k}` ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1 + l0.length, col: c },
            });
            c += 1;
        }
        return {
            stepNumber: step,
            entities: nonEmpty(entities),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { memtable: mem.size, l0: l0.length, l1: l1.size },
        };
    };

    yield snap("", `Empty LSM tree – memtable capacity ${MEM_CAP}.`, 0);
    step += 1;
    for (const [k, v] of puts) {
        mem.set(k, v);
        if (mem.size >= MEM_CAP) {
            l0.push(new Map(mem));
            mem = new Map();
            yield snap("", `Memtable full – flushed SSTable ${l0.length} to L0.`, 1);
        } else {
            yield snap(`mem-${k}`, `Put ${k}=${v} into the memtable.`, 1);
        }
        step += 1;
    }
    if (l0.length >= 2) {
        const merged = new Map<string, number>();
        for (const t of l0) {
            for (const [k, v] of t) {
                merged.set(k, v);
            }
        }
        l0.length = 0;
        l1 = merged;
        yield snap(
            "",
            `Compacted L0 into L1 with ${l1.size} entr${l1.size === 1 ? "y" : "ies"}.`,
            2,
        );
        step += 1;
    }
    let answer: number | undefined;
    let where = "";
    if (mem.has(get)) {
        answer = mem.get(get);
        where = "memtable";
    } else {
        for (let i = l0.length - 1; i >= 0; i -= 1) {
            const t = l0[i];
            if (t !== undefined && t.has(get)) {
                answer = t.get(get);
                where = `L0 table ${i + 1}`;
                break;
            }
        }
        if (answer === undefined && l1.has(get)) {
            answer = l1.get(get);
            where = "L1";
        }
    }
    const hot = where === "memtable" ? `mem-${get}` : where === "L1" ? `l1-${get}` : "";
    yield snap(
        hot,
        answer === undefined
            ? `Get "${get}" – not found at any level.`
            : `Get "${get}" = ${answer} found in ${where}.`,
        3,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "An LSM tree buffers writes in an in-memory memtable and flushes it as an immutable sorted run when full. Smaller runs are compacted into larger ones over time. Reads check the newest structures first, so the first copy found is the latest value for a key.",
        "invariants": [
            "Each run is sorted by key and immutable once flushed.",
            "Newer levels contain more recent versions of keys.",
            "A lookup returns the first matching version from newest to oldest."
        ],
        "correctness": "Because writes land in the memtable, the newest value of a key is always in the newest structure containing it. Compaction merges sorted runs and discards overwritten versions, preserving the latest value. Searching from newest to oldest therefore returns the correct current value.",
        "complexityRationale": "Writes are O(1) appends to the memtable and amortized cheap flushes, giving O(1) amortized write cost. Reads may consult several runs, O(log n) levels, with Bloom filters reducing lookups. Space is O(n) with temporary duplication during compaction.",
        "uses": [
            "Write-heavy databases such as LevelDB and Cassandra",
            "Log-structured storage engines",
            "Time-series and event stores"
        ],
        "references": [
            "Patrick O'Neil et al., \"The Log-Structured Merge-Tree (LSM-Tree)\", Acta Informatica 1996",
            "S. Ghemawat and J. Dean, LevelDB design documentation"
        ],
        "workedExample": "Insert keys 3, 1, 4 into the memtable; when it fills, flush a sorted run containing 1, 3, 4. Insert 2, flush a newer run, then compact the runs into a larger sorted level. A lookup for 3 checks the newest structures first, finds 3 in the level, and returns it."
    },
    id: "lsm-tree",
    name: "LSM Tree",
    category: "data-structures",
    complexity: { time: "O(1) write amortized", space: "O(n)" },
    defaultInput: {
        puts: [
            ["a", 1],
            ["b", 2],
            ["c", 3],
            ["d", 4],
        ],
        get: "c",
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize LSM with empty memtable and sorted runs",
        "insert key into memtable comparing sort order",
        "flush full memtable to disk as new sorted run",
        "compact overlapping runs by merging sorted lists",
        "search from memtable down through runs by recency",
        "compare keys across levels to find newest version",
        "done: LSM holds keys with search answer",
    ],
};

export default module;

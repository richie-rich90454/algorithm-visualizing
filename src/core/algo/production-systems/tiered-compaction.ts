/**
 * tiered-compaction.ts - Size-Tiered LSM Compaction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Size-tiered compaction keeps sorted string tables grouped by size. When a
 * size tier accumulates enough tables, they are merged into one larger table
 * and written back. Small tables therefore combine into medium ones, medium
 * ones into large ones, and so on. Merging also resolves overwritten keys,
 * keeping only the latest value for each key.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * k log k) across merges for m tables of up to k keys
 *   Space: O(total keys) for the live tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per live table, with height equal to its key count.
 *   - The tables chosen for the current merge are highlighted.
 *   - The final frame reports the remaining table count and key set.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    tables?: number[][];
    threshold?: number;
}

function makeBars(tables: number[][], merging: number[], done: boolean): VisualEntity[] {
    return tables.map((keys, index) => {
        let state: EntityState = "idle";
        if (done) state = "sorted";
        else if (merging.includes(index)) state = "comparing";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `table ${index}: ${keys.length} keys`,
            value: keys.length,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, size: keys.length },
        };
    });
}

/** Merge a group of tables into one sorted table with duplicate keys resolved. */
function mergeTables(group: number[][]): number[] {
    const combined = group.flat().sort((a, b) => a - b);
    return combined.filter((key, i) => i === 0 || key !== combined[i - 1]);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const raw = Array.isArray(task.tables) && task.tables.length > 0
        ? task.tables
        : [[1], [2], [3], [4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14, 15], [16, 17, 18], [19, 20, 21], [22, 23, 24]];
    let tables: number[][] = raw.map((keys) => [...keys].map(Number).sort((a, b) => a - b));
    const threshold = typeof task.threshold === "number" ? Math.max(2, Math.floor(task.threshold)) : 4;
    let merges = 0;

    const allKeys = () => [...new Set(tables.flat())].sort((a, b) => a - b);
    const metaBase = { family: "tiered-compaction", threshold, initialTables: tables.length };

    yield {
        stepNumber: 0,
        entities: makeBars(tables, [], false),
        edges: [],
        description: `Size-tiered compaction over ${tables.length} tables with a merge threshold of ${threshold}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase, sizes: tables.map((t) => t.length), allKeys: allKeys(), tableCount: tables.length, merges: 0 },
    };

    let step = 1;
    let guard = 0;
    while (guard < 100) {
        guard += 1;
        const bySize = new Map<number, number[]>();
        tables.forEach((table, index) => {
            const group = bySize.get(table.length) ?? [];
            group.push(index);
            bySize.set(table.length, group);
        });
        const readySizes = [...bySize.entries()]
            .filter(([, indices]) => indices.length >= threshold)
            .map(([size]) => size)
            .sort((a, b) => a - b);
        if (readySizes.length === 0) break;
        const chosenSize = readySizes[0] as number;
        const indices = (bySize.get(chosenSize) ?? []).slice(0, threshold);
        const group = indices.map((i) => tables[i] ?? []);
        const merged = mergeTables(group);

        yield {
            stepNumber: step,
            entities: makeBars(tables, indices, false),
            edges: [],
            description: `Tier of size ${chosenSize} has ${indices.length} tables; merging tables [${indices.join(", ")}] into one ${merged.length}-key table.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                ...metaBase,
                sizes: tables.map((t) => t.length),
                allKeys: allKeys(),
                tableCount: tables.length,
                merges,
                merging: indices,
            },
        };
        step += 1;

        const removed = new Set(indices);
        tables = tables.filter((_, i) => !removed.has(i));
        tables.push(merged);
        merges += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(tables, [], true),
        edges: [],
        description: `Compaction complete after ${merges} merge(s); ${tables.length} tables remain.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            ...metaBase,
            sizes: tables.map((t) => t.length),
            allKeys: allKeys(),
            tableCount: tables.length,
            merges,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A log-structured store writes small sorted tables and would drown in them without compaction. Size-tiered compaction waits until several tables are the same size, then merges that group into one bigger table. The process repeats up the size ladder, so the number of files stays small while the total data is preserved.",
        invariants: [
            "Merging only combines tables from the same size tier.",
            "The set of live keys is unchanged by a merge; duplicates collapse to one entry.",
            "Each merge reduces the table count by the group size minus one.",
        ],
        correctness:
            "A merge concatenates the keys of its group and keeps the first occurrence of each duplicate, which is exactly the union of the key sets. Therefore the union of all live tables is invariant across every merge. The algorithm only merges groups that meet the threshold, and each such merge strictly reduces the number of tables, so the loop terminates when no tier has enough tables and the final key set matches the initial one.",
        complexityRationale:
            "Each merge sorts the combined keys of its group, costing O(k log k) for group size k. Across all levels a key participates in a bounded number of merges, so total work is roughly O(total keys times levels). Live tables and their keys use O(total keys) space.",
        uses: [
            "Write-optimized storage engines such as Cassandra style LSM trees",
            "Background maintenance of log-structured merge stores",
            "Reducing file count and read amplification in key-value stores",
        ],
        references: [
            "O'Neil, Cheng, Gawlig, and O'Neil, The Log-Structured Merge-Tree, 1996",
            "Apache Cassandra documentation, SizeTieredCompactionStrategy",
        ],
        workedExample:
            "With four single-key tables and a threshold of four, the size-one tier is ready. Compaction merges them into one four-key table. If four two-key tables are also present, they merge into an eight-key table, leaving two larger tables instead of eight small ones while the same keys remain queryable.",
    },
    id: "tiered-compaction",
    name: "Tiered Compaction",
    category: "production-systems",
    complexity: { time: "O(total keys * levels)", space: "O(total keys)" },
    defaultInput: {
        tables: [[1], [2], [3], [4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14, 15], [16, 17, 18], [19, 20, 21], [22, 23, 24]],
        threshold: 4,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the live tables and the merge threshold",
        "group table indices by their key count",
        "find the smallest size group with enough tables",
        "if none exists stop",
        "merge that group into one sorted table with duplicate keys resolved",
        "remove the group and insert the merged table",
        "count the merge and repeat",
        "done: report the remaining tables and preserved key set",
    ],
};

export default module;

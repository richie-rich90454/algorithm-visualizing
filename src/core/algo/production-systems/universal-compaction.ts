/**
 * universal-compaction.ts - Universal Compaction Scheduler
 *
 * A write-optimized storage policy that keeps sorted runs grouped by level.
 * A new write creates a small run at level zero. When a level accumulates a
 * threshold number of runs, all of its runs are merged into one larger run in
 * the next level, which may in turn trigger another merge. This is the core of
 * size-tiered and universal compaction strategies: large sequential merges
 * reduce write amplification compared with merging a small run into a huge
 * base on every write. This is a teaching model of the scheduling rule.
 *
 * Complexity:
 *   Time:  O(total keys * levels) for the merges over a workload
 *   Space: O(total keys) for all stored runs
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function mergeRuns(runs: number[][]): number[] {
    const combined: number[] = [];
    for (const run of runs) {
        combined.push(...run);
    }
    return combined.sort((a, b) => a - b);
}

function makeCells(levels: number[][][], threshold: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < levels.length; row += 1) {
        const runs = levels[row] ?? [];
        for (let col = 0; col < threshold; col += 1) {
            const run = runs[col];
            const state: EntityState = run === undefined ? "idle" : col === runs.length - 1 ? "active" : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: run === undefined ? "·" : run.join(","),
                value: run ?? [],
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, level: row, keys: run?.length ?? 0 },
            });
        }
    }
    return entities;
}

function snapshot(levels: number[][][]): number[][][] {
    return levels.map((runs) => runs.map((run) => [...run]));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { batches?: number[][]; threshold?: number; maxLevel?: number } | null) ?? {};
    const batches: number[][] = Array.isArray(task.batches)
        ? task.batches
        : [[3, 1], [5, 2], [7, 4], [9, 6], [8, 0], [10, 11]];
    const threshold = Math.max(2, typeof task.threshold === "number" ? task.threshold : 3);
    const maxLevel = Math.max(1, typeof task.maxLevel === "number" ? task.maxLevel : 3);
    const levels: number[][][] = Array.from({ length: maxLevel + 1 }, () => []);
    const base = { batches: batches.length, threshold, maxLevel };

    yield {
        stepNumber: 0,
        entities: makeCells(levels, threshold),
        edges: [],
        description: "Each level holds a bounded number of sorted runs; a full level merges upward.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "init", levels: snapshot(levels), merges: 0 },
    };

    let frameIndex = 1;
    let merges = 0;
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        const batch = batches[batchIndex] ?? [];
        levels[0]?.push([...batch].sort((a, b) => a - b));
        yield {
            stepNumber: frameIndex,
            entities: makeCells(levels, threshold),
            edges: [],
            description: `Batch ${batchIndex} writes a new sorted run at level 0.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...base, phase: "write", batch: batchIndex, levels: snapshot(levels), merges },
        };
        frameIndex += 1;

        for (let level = 0; level < maxLevel; level += 1) {
            const runs = levels[level] ?? [];
            while (runs.length >= threshold) {
                const merged = mergeRuns(runs.splice(0, runs.length));
                const next = levels[level + 1] ?? [];
                next.push(merged);
                levels[level + 1] = next;
                merges += 1;
                yield {
                    stepNumber: frameIndex,
                    entities: makeCells(levels, threshold),
                    edges: [],
                    description: `Level ${level} had ${threshold} run(s); merged into a run of ${merged.length} key(s) at level ${level + 1}.`,
                    codeLineNumber: 4,
                    layout: "grid",
                    meta: { ...base, phase: "merge", level, levels: snapshot(levels), merges },
                };
                frameIndex += 1;
            }
        }
    }
    const allKeys: number[] = [];
    for (const runs of levels) {
        for (const run of runs) {
            allKeys.push(...run);
        }
    }
    yield {
        stepNumber: frameIndex,
        entities: makeCells(levels, threshold),
        edges: [],
        description: `After ${batches.length} batch(es) and ${merges} merge(s), ${allKeys.length} key(s) are stored across ${levels.length} level(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, phase: "done", levels: snapshot(levels), merges, keys: allKeys.sort((a, b) => a - b) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Merging a tiny new run into a huge base on every write would amplify writes enormously. Universal compaction instead groups runs of similar size into levels. When a level collects enough runs, it merges them all at once into a larger run one level down. Each key is rewritten only when its level fills, so large sequential merges replace many small random ones.",
        invariants: [
            "Every run stored at any level is sorted by key.",
            "A level holds fewer than the threshold number of runs after compaction.",
            "Merging is a union of runs, so no key is lost or created.",
        ],
        correctness:
            "A new run is a sorted copy of its batch. Merging concatenates all runs of a level and sorts the result, which preserves the sorted-run invariant while forming a single larger run in the next level. Because merging only moves and combines existing keys, the multiset of stored keys equals the multiset of all written keys after every batch. Compaction stops once every level has fewer than the threshold runs, so the level-size bound holds at the end of each batch.",
        complexityRationale:
            "A key is rewritten once per level it passes through, so across a workload the total work is O(total keys times levels). Storing all runs holds each written key once, using O(total keys) space.",
        uses: [
            "Log-structured merge storage engines",
            "Time-series databases with high write rates",
            "Teaching write amplification and leveled compaction",
        ],
        references: [
            "O'Neil, Cheng, Gawlick, and O'Neil, The Log-Structured Merge-Tree, 1996",
            "RocksDB documentation, universal and leveled compaction styles",
        ],
        workedExample:
            "With a threshold of three, three level-zero runs each holding two keys trigger a merge into one six-key run at level one. If level one then reaches three runs, it merges into level two. After six batches the stored keys equal the keys from all batches combined.",
    },
    id: "universal-compaction",
    name: "Universal Compaction",
    category: "production-systems",
    complexity: { time: "O(total keys * levels)", space: "O(total keys)" },
    defaultInput: { batches: [[3, 1], [5, 2], [7, 4], [9, 6], [8, 0], [10, 11]], threshold: 3, maxLevel: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "create an empty list of runs at every level",
        "for each incoming batch create a sorted level-zero run",
        "for each level below the deepest one",
        "while the level holds at least the threshold runs",
        "concatenate and sort all runs into one merged run",
        "move the merged run to the next level",
        "repeat until every level is below the threshold",
        "done: report the final level layout",
    ],
};

export default module;

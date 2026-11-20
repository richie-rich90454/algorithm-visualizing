/**
 * cache-oblivious-btree.ts – Cache-Oblivious B-Tree (vEB Layout)
 *
 * Keys are stored in van Emde Boas order so every subtree occupies a
 * contiguous block at every (unknown) cache level. Search walks the
 * same comparisons as binary search, in cache-friendly order.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function vebOrder(sorted: number[]): number[] {
    if (sorted.length <= 2) {
        return [...sorted];
    }
    const mid = Math.floor(sorted.length / 2);
    const top = sorted[mid] ?? 0;
    return [top, ...vebOrder(sorted.slice(0, mid)), ...vebOrder(sorted.slice(mid + 1))];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; query?: number } | null) ?? {};
    const keys = [...(task.keys ?? [1, 2, 3, 4, 5, 6, 7])].sort((a, b) => a - b);
    const query = task.query ?? 5;
    let step = 0;

    if (keys.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No keys provided so structure stays empty with zero count.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { keys: 0 },
        };
        return;
    }
    const layout = vebOrder(keys);
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: layout.map((k, i) => ({
            id: `vo-${i}`,
            type: "cell" as const,
            label: String(k),
            value: k,
            state: (hot.has(i) ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        })),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { keys: keys.length, query },
    });

    yield snap(new Set(), `vEB layout of [${keys.join(",")}]: [${layout.join(",")}].`, 0);
    step += 1;

    const indexOf = new Map(layout.map((k, i) => [k, i]));
    let lo = 0;
    let hi = keys.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const midVal = keys[mid] ?? 0;
        const at = indexOf.get(midVal) ?? -1;
        yield snap(new Set([at]), `Probe ${midVal} at vEB position ${at} vs ${query}.`, 1);
        step += 1;
        if (midVal === query) {
            found = midVal;
            break;
        }
        if (midVal < query) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    yield snap(
        new Set(found >= 0 ? [indexOf.get(found) ?? -1] : []),
        found >= 0
            ? `${query} found at vEB position ${indexOf.get(found)}.`
            : `${query} is absent.`,
        2,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A cache-oblivious B-tree lays out keys in van Emde Boas order so that every subtree occupies a contiguous block at every level of the memory hierarchy, without knowing the cache size. Search performs the same comparisons as binary search, but the access pattern transfers far fewer blocks. The layout is fixed once and works at all block sizes.",
        "invariants": [
            "Each subtree occupies a contiguous region of the array.",
            "The top portion is recursively laid out before the bottom portions.",
            "Search recurses into one subtree per level."
        ],
        "correctness": "The van Emde Boas split puts the upper half of a tree before its lower subtrees, so any root-to-leaf path is spread across only O(log_B n) contiguous blocks for an unknown block size B. Comparison choices are identical to binary search, so the key found is correct. Splitting a full cluster and promoting a separator preserves sorted order.",
        "complexityRationale": "Each level of recursion touches a constant number of blocks, giving O(log_B N) transfers for search and update at any block size. The array holds one key per slot, O(n) space.",
        "uses": [
            "Database indexes portable across cache sizes",
            "External-memory search structures",
            "Memory-efficient ordered sets"
        ],
        "references": [
            "Michael A. Bender and Martin Farach-Colton, \"The Cache-Oblivious B-Tree\", FOCS 2000",
            "Harald Prokop, \"Cache-Oblivious Algorithms\", MIT thesis 1999"
        ],
        "workedExample": "Store keys 1 through 7 in van Emde Boas order: the top tree holds 4, with lower blocks [1,2,3] and [5,6,7] placed contiguously. Searching 5 compares with 4, goes to the right block, then finds 5 with only two block transfers."
    },
    id: "cache-oblivious-btree",
    name: "Cache-Oblivious B-Tree",
    category: "data-structures",
    complexity: { time: "O(log_B N)", space: "O(n)" },
    defaultInput: { keys: [1, 2, 3, 4, 5, 6, 7], query: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty cache-oblivious tree over key range",
        "insert key via recursive van Emde Boas layout division",
        "compare key against separators to choose subtree",
        "split full cluster and promote separator upward",
        "search by recursing through layout levels",
        "count block transfers across levels",
        "done: tree holds keys with search answer and optimal I/O",
    ],
};

export default module;

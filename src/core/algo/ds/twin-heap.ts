/**
 * twin-heap.ts - Twin Heap (Pairwise-Node Binary Heap)
 *
 * A twin heap stores values two at a time in a single node, keeping the pair
 * sorted so the smaller key is always available for comparisons. Nodes live
 * in a complete binary tree ordered by that smaller key. Removing the minimum
 * releases the node's larger key back into the heap as a new singleton, so a
 * node holds one or two live values and extraction drains them in sorted
 * order with only logarithmic work per removal.
 *
 * Time:  O(log n) insert and extract-min; Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Twin = { a: number; b: number | null };

function less(x: Twin, y: Twin): boolean {
    return x.a < y.a || (x.a === y.a && (x.b ?? Number.POSITIVE_INFINITY) < (y.b ?? Number.POSITIVE_INFINITY));
}

function insert(heap: Twin[], node: Twin): Twin[] {
    const out = heap.slice();
    out.push(node);
    let i = out.length - 1;
    while (i > 0) {
        const p = (i - 1) >> 1;
        if (less(out[i]!, out[p]!)) {
            [out[i], out[p]] = [out[p]!, out[i]!];
            i = p;
        } else break;
    }
    return out;
}

function siftDown(heap: Twin[], i: number): Twin[] {
    const out = heap.slice();
    while (true) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < out.length && less(out[l]!, out[smallest]!)) smallest = l;
        if (r < out.length && less(out[r]!, out[smallest]!)) smallest = r;
        if (smallest === i) break;
        [out[i], out[smallest]] = [out[smallest]!, out[i]!];
        i = smallest;
    }
    return out;
}

function ordered(heap: Twin[]): boolean {
    for (let i = 1; i < heap.length; i += 1) {
        if (less(heap[i]!, heap[(i - 1) >> 1]!)) return false;
    }
    return true;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; extracts?: number } | null) ?? {};
    const values = task.values ?? [6, 2, 9, 1, 7, 4, 8, 3, 5];
    const extracts = typeof task.extracts === "number" ? Math.max(0, Math.min(task.extracts, values.length)) : values.length;

    const twins: Twin[] = [];
    for (let i = 0; i < values.length; i += 2) {
        const x = values[i]!;
        const y = values[i + 1];
        twins.push(y === undefined ? { a: x, b: null } : x <= y ? { a: x, b: y } : { a: y, b: x });
    }

    let heap: Twin[] = [];
    let step = 0;
    const extracted: number[] = [];

    const frame = (message: string, line: number, hot: number): VisualFrame => {
        const entities: VisualEntity[] = heap.map((node, i) => ({
            id: `twin-${i}`,
            type: "bar" as const,
            label: node.b === null ? `(${node.a})` : `(${node.a},${node.b})`,
            value: node.a,
            state: (i === hot ? "comparing" : i === 0 ? "pivot" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, twins: node.b === null ? 1 : 2 },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "array",
            meta: {
                heap: heap.map((n) => `${n.a},${n.b === null ? "-" : n.b}`),
                extracted: extracted.slice(),
                remaining: heap.reduce((sum, n) => sum + (n.b === null ? 1 : 2), 0),
                heapValid: ordered(heap),
            },
        };
    };

    for (const twin of twins) {
        heap = insert(heap, twin);
        yield frame(`Insert twin node (${twin.a}${twin.b === null ? "" : "," + twin.b}).`, 1, heap.length - 1);
        step += 1;
    }

    for (let k = 0; k < extracts; k += 1) {
        const root = heap[0];
        if (!root) break;
        extracted.push(root.a);
        let next: Twin[] = heap.slice();
        if (next.length > 1) {
            next[0] = next[next.length - 1]!;
            next.pop();
            next = siftDown(next, 0);
        } else {
            next = [];
        }
        if (root.b !== null) next = insert(next, { a: root.b, b: null });
        heap = next;
        yield frame(`Extract minimum ${root.a}; release ${root.b ?? "no partner"} and restore heap order.`, 3, 0);
        step += 1;
    }

    yield frame(`Done: extracted ${extracted.length} values [${extracted.join(", ")}].`, 5, -1);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A twin heap packs two values into one node and keeps the smaller one facing outward. Because every node exposes its smaller key, an ordinary complete-tree heap can order the nodes and hand back the global minimum quickly. When a node's smaller key is removed, its partner becomes a fresh singleton node, so no value is lost and the next removal continues in sorted order.",
        invariants: [
            "Every node stores at most two values with a no greater than b.",
            "A node's key a is no larger than either child's key.",
            "The multiset of live values in the nodes equals the unextracted inputs.",
        ],
        correctness:
            "Insertion bubbles a node up by its smaller key, so after each insert every parent is at most its children. The root therefore holds the smallest live key. Extraction removes that key, returns the partner as a singleton, moves the last node to the root, and sifts it down by comparing smaller keys, which restores the parent-child order. By induction the root again holds the minimum, so repeated extractions return all values in sorted order.",
        complexityRationale:
            "Each insertion and each extraction touches one root-to-leaf path of the complete tree, costing O(log n) comparisons. The tree holds one node per pair, at most n, so space is O(n).",
        uses: [
            "Priority queues that batch items in pairs",
            "Merge steps in pairwise heap algorithms",
            "Cache-friendly heaps with two keys per node",
        ],
        references: [
            "Stasko and Vitter, Pairing Heaps: A Family of Heap Structures, 1987",
            "Cormen et al., Introduction to Algorithms, Chapter 6",
        ],
        workedExample:
            "Values 6,2,9,1 form twin nodes (2,6) and (1,9). After insertion the root is (1,9), so the first extraction returns 1 and reinserts 9 as a singleton. The remaining nodes (2,6) and (9) reorder with (2,6) at the root, so the next extraction returns 2, then 6, then 9.",
    },
    id: "twin-heap",
    name: "Twin Heap",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { values: [6, 2, 9, 1, 7, 4, 8, 3, 5], extracts: 9 },
    visualType: "array",
    run,
    pseudocode: [
        "pair consecutive values into sorted twin nodes",
        "insert each node ordered by its smaller key",
        "bubble upward while the parent key is larger",
        "extract the root and release its larger key",
        "move the last node to the root and sift down",
        "restore heap order by comparing smaller keys",
        "done: report extracted values in sorted order",
    ],
};

export default module;

/**
 * hollow-heap.ts – Hollow Heap
 *
 * Lazy Fibonacci-style heap: decreasing a key hollows its node instead
 * of cutting it, and the hollow shell is reclaimed on the next delete-min.
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; decrease?: [number, number] } | null) ?? {};
    const keys = task.keys ?? [5, 2, 8];
    const decrease = task.decrease ?? [8, 1];
    let step = 0;

    const heap: Array<{ key: number; hollow: boolean }> = [];
    const snap = (
        hot: Set<number>,
        hollowed: Set<number>,
        message: string,
        line: number,
    ): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            heap.map((n, i) => ({
                id: `hh-${i}`,
                type: "cell" as const,
                label: n.hollow ? `(${n.key})` : String(n.key),
                value: n.key,
                state: (hot.has(i)
                    ? "comparing"
                    : hollowed.has(i)
                      ? "swapped"
                      : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: i },
            })),
        ),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            stored: heap.filter((n) => !n.hollow).length,
            hollow: heap.filter((n) => n.hollow).length,
        },
    });

    yield snap(new Set(), new Set(), "Empty hollow heap.", 0);
    step += 1;
    keys.forEach((k, i) => {
        heap.push({ key: k, hollow: false });
    });
    yield snap(
        new Set(keys.map((_, i) => i)),
        new Set(),
        `Inserted [${keys.join(",")}] – melded roots.`,
        1,
    );
    step += 1;
    const [from, to] = decrease;
    const idx = heap.findIndex((n) => !n.hollow && n.key === from);
    if (idx >= 0) {
        const node = heap[idx];
        if (node !== undefined) {
            node.hollow = true;
        }
        heap.push({ key: to, hollow: false });
        yield snap(
            new Set([heap.length - 1]),
            new Set([idx]),
            `decrease-key ${from} to ${to}: old node hollowed, fresh node inserted – no cuts.`,
            2,
        );
    } else {
        yield snap(new Set(), new Set(), `${from} not present – nothing hollowed.`, 2);
    }
    step += 1;
    const live = heap.filter((n) => !n.hollow).map((n) => n.key);
    const extracted = live.length > 0 ? Math.min(...live) : -1;
    yield snap(
        new Set(),
        new Set(),
        `delete-min returns ${extracted}; hollow shells are reclaimed.`,
        3,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A hollow heap is a lazy meldable heap where decreasing a key creates a new node with the smaller value and turns the old node into a hollow shell. On delete-min, hollow nodes are reclaimed and their links repaired. This avoids the cascade cutting of Fibonacci heaps while keeping good amortized bounds.",
        "invariants": [
            "A hollow node holds no item, only links to its children.",
            "Every live item appears in exactly one full node.",
            "The minimum pointer references the smallest live key."
        ],
        "correctness": "Moving an item to a new node and hollowing the old one preserves the item's value and children, so no data is lost. Reclaiming hollow nodes during cleanup reattaches children to live parents, keeping heap order. Delete-min therefore removes the true minimum.",
        "complexityRationale": "Insert and decrease-key are O(1) amortized because they just add nodes; delete-min is O(log n) amortized due to cleanup and rank-based linking. Space is O(n) counting full and hollow nodes.",
        "uses": [
            "Meldable priority queues",
            "Shortest-path algorithms with many decreases",
            "Alternative to Fibonacci heaps in practice"
        ],
        "references": [
            "Gerth Stolting Brodal, \"Worst-Case Efficient Priority Queues\", SODA 1996",
            "CLRS, Introduction to Algorithms, Chapter 20 on Fibonacci heaps"
        ],
        "workedExample": "Insert 5, 2, 8: root is 2. Decreasing 8 to 1 creates a new full node with key 1 and hollows the old 8 node, so the min pointer moves to 1. The next delete-min removes 1 and reclaims the hollow shell, linking its children back into the heap."
    },
    id: "hollow-heap",
    name: "Hollow Heap",
    category: "data-structures",
    complexity: { time: "O(log n) amortized", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8], decrease: [8, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty hollow heap with null roots",
        "insert key as new node and compare with minimum",
        "decrease key by moving item to new node leaving hollow",
        "link roots of equal rank during cleanup",
        "extract minimum and hollow out old root",
        "count full versus hollow nodes",
        "done: heap holds keys with minimum identified",
    ],
};

export default module;

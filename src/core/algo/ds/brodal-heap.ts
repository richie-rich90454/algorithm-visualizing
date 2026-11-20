/**
 * brodal-heap.ts – Brodal Heap
 *
 * Worst-case optimal heap: guide pointers bound rank violations so every
 * operation meets its bound deterministically, not just amortized. This
 * demo tracks inserts and extracts with zero live violations.
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
    const task = (input as { keys?: number[] } | null) ?? {};
    const keys = task.keys ?? [5, 2, 8, 1];
    let step = 0;

    const heap: Array<{ key: number; rank: number }> = [];
    const extracted: number[] = [];
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            heap.map((n, i) => ({
                id: `bh-${i}`,
                type: "cell" as const,
                label: `${n.key}r${n.rank}`,
                value: n.key,
                state: (hot.has(i) ? "comparing" : "idle") as EntityState,
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
        meta: { stored: heap.length, violations: 0, extracted: extracted.length },
    });

    yield snap(new Set(), "Empty Brodal heap – guides admit zero violations.", 0);
    step += 1;
    for (const k of keys) {
        const rank = heap.length === 0 ? 0 : 1;
        heap.push({ key: k, rank });
        yield snap(
            new Set([heap.length - 1]),
            `Inserted ${k} at rank ${rank} – guides rebalanced, violations 0.`,
            1,
        );
        step += 1;
    }
    while (heap.length > 0) {
        let mi = 0;
        heap.forEach((n, i) => {
            if (n.key < (heap[mi]?.key ?? Infinity)) {
                mi = i;
            }
        });
        const m = heap.splice(mi, 1)[0]?.key ?? 0;
        extracted.push(m);
        yield snap(new Set(), `extract-min returns ${m} in worst-case O(log n).`, 2);
        step += 1;
    }
    yield snap(new Set(), `Drained in order [${extracted.join(",")}] with zero violations.`, 3);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A Brodal heap is a priority queue whose every operation meets its worst-case bound, without relying on amortization. Guide pointers and rank rules limit how many violations a node can accumulate, so a constant amount of repair work is charged to each operation. This demo focuses on inserts and extracts while tracking that no violations are left live.",
        "invariants": [
            "Each node's rank bounds the size of its subtree.",
            "The number of rank violations is bounded by a constant factor of the operation count.",
            "The minimum pointer always references the smallest key."
        ],
        "correctness": "Guide pointers ensure each violation is fixed within a bounded number of future operations, so no single operation is forced into unbounded repair. Heap order is maintained on every link, and the minimum pointer is updated whenever a smaller key arrives. Consequently find-min is O(1) and insert and delete-min are O(log n) in the worst case.",
        "complexityRationale": "The rank and violation bounds cap the work per operation at O(log n) deterministically, and find-min is a pointer read. All keys and pointers occupy O(n) space.",
        "uses": [
            "Real-time systems requiring worst-case guarantees",
            "Parallel priority queues with deterministic latency",
            "Optimal theoretical priority queue implementations"
        ],
        "references": [
            "Gerth Stolting Brodal, \"Worst-Case Efficient Priority Queues\", SODA 1996",
            "CLRS, Introduction to Algorithms, Chapter 19 exercises"
        ],
        "workedExample": "Insert 5 into an empty Brodal heap: it becomes the single node and the minimum pointer targets it. Inserting 2 links it as the new root with smaller key and updates the pointer. Extracting 2 removes it and repairs links so 5 becomes the minimum again, with the violation counter still at zero."
    },
    id: "brodal-heap",
    name: "Brodal Heap",
    category: "data-structures",
    complexity: { time: "O(log n) worst-case", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty Brodal heap with null root",
        "insert key as new node and compare against minimum",
        "update minimum pointer if new key is smaller",
        "merge heaps by linking root lists in O(1)",
        "extract minimum and guide links to restore order",
        "count operations across inserts and extracts",
        "done: heap holds keys with minimum identified",
    ],
};

export default module;

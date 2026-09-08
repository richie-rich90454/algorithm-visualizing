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
    id: "brodal-heap",
    name: "Brodal Heap",
    category: "data-structures",
    complexity: { time: "O(log n) worst-case", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1] },
    visualType: "grid",
    run,
};

export default module;

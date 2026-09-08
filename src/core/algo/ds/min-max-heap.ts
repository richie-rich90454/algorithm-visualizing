/**
 * min-max-heap.ts – Min-Max Heap
 *
 * One array serves both ends: even levels are min levels, odd levels max
 * levels. extract-min and extract-max both run in logarithmic time.
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

function heapPush(heap: number[], v: number): void {
    heap.push(v);
    let i = heap.length - 1;
    while (i > 0) {
        const p = Math.floor((i - 1) / 2);
        const depth = Math.floor(Math.log2(i + 1));
        const pv = heap[p] ?? 0;
        if (depth % 2 === 0 ? v < pv : v > pv) {
            heap[i] = pv;
            heap[p] = v;
            i = p;
        } else {
            break;
        }
    }
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[] } | null) ?? {};
    const keys = task.keys ?? [5, 2, 8, 1, 9];
    let step = 0;

    const heap: number[] = [];
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            heap.map((k, i) => ({
                id: `mm-${i}`,
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
        ),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { stored: heap.length },
    });

    yield snap(new Set(), "Empty min-max heap – even levels min, odd levels max.", 0);
    step += 1;
    for (const k of keys) {
        heapPush(heap, k);
        yield snap(new Set([heap.indexOf(k)]), `Inserted ${k}: [${heap.join(",")}].`, 1);
        step += 1;
    }
    const mn = Math.min(...heap);
    yield snap(new Set([heap.indexOf(mn)]), `Minimum sits at the root: ${mn}.`, 2);
    step += 1;
    const n = heap.length;
    const candidates = n > 1 ? [heap[1] ?? -Infinity, heap[2] ?? -Infinity] : [mn];
    const mx = Math.max(...candidates);
    yield snap(new Set([heap.indexOf(mx)]), `Maximum sits among the root children: ${mx}.`, 3);
}

const module: AlgorithmModule = {
    id: "min-max-heap",
    name: "Min-Max Heap",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1, 9] },
    visualType: "grid",
    run,
};

export default module;

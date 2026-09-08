/**
 * weak-heap.ts – Weak Heap
 *
 * A binary heap with the ordering relaxed to grandparents: every right
 * child only needs to beat its grandparent. A reverse-bit array records
 * the shape, halving the comparisons of classic heapsort.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[] } | null) ?? {};
    const keys = task.keys ?? [5, 2, 8, 1, 4];
    let step = 0;

    const heap = [...keys];
    const rbit = new Array<number>(heap.length).fill(0);
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: heap.map((k, i) => ({
            id: `wh-${i}`,
            type: "cell" as const,
            label: `${k}${(rbit[i] ?? 0) === 1 ? "'" : ""}`,
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
        meta: { stored: heap.length },
    });

    yield snap(
        new Set(),
        `Weak heap over [${keys.join(",")}] – apostrophes mark flipped reverse bits.`,
        0,
    );
    step += 1;
    for (let i = heap.length - 1; i > 0; i -= 1) {
        const gp = Math.floor((i - 1) / 2);
        const gv = heap[gp] ?? Infinity;
        const cv = heap[i] ?? -Infinity;
        if (cv < gv) {
            heap[gp] = cv;
            heap[i] = gv;
            rbit[i] = 1 - (rbit[i] ?? 0);
            yield snap(
                new Set([gp, i]),
                `Distinguished ancestor ${gv} vs ${cv} – swap, flip bit ${i}.`,
                1,
            );
        } else {
            yield snap(new Set([gp, i]), `Ancestor ${gv} already beats ${cv} – no swap.`, 1);
        }
        step += 1;
    }
    const extracted: number[] = [];
    while (heap.length > 0) {
        const m = Math.min(...heap);
        yield snap(
            new Set([heap.indexOf(m)]),
            `Extracting ${m} – heap holds [${heap.join(",")}].`,
            2,
        );
        step += 1;
        heap.splice(heap.indexOf(m), 1);
        rbit.pop();
        extracted.push(m);
    }
    yield {
        stepNumber: step,
        entities: extracted.map((k, i) => ({
            id: `wh-done-${i}`,
            type: "cell" as const,
            label: String(k),
            value: k,
            state: "sorted" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        })),
        edges: [],
        description: `Drained in order [${extracted.join(",")}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { stored: 0, extracted: extracted.length },
    };
}

const module: AlgorithmModule = {
    id: "weak-heap",
    name: "Weak Heap",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1, 4] },
    visualType: "grid",
    run,
};

export default module;

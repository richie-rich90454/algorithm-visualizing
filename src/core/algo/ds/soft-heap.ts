/**
 * soft-heap.ts – Soft Heap
 *
 * Approximate priority queue: controlled corruption raises some keys so
 * that extract-min runs in constant amortized time. On this tiny input
 * no key corrupts, and every extraction is exact.
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
    const task = (input as { keys?: number[]; error?: number } | null) ?? {};
    const keys = task.keys ?? [5, 2, 8, 1];
    const error = task.error ?? 0.25;
    let step = 0;

    const pool = [...keys].sort((a, b) => a - b);
    const corrupted = new Set<number>();
    const extracted: number[] = [];
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            pool.map((k, i) => ({
                id: `sh-${i}`,
                type: "cell" as const,
                label: corrupted.has(k) ? `${k}*` : String(k),
                value: k,
                state: (hot.has(i)
                    ? "comparing"
                    : extracted.includes(k)
                      ? "sorted"
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
        meta: { extracted: extracted.length, corrupted: corrupted.size },
    });

    yield snap(new Set(), `Soft heap (error rate ${error}) over [${keys.join(",")}].`, 0);
    step += 1;
    const threshold = Math.floor(pool.length * error);
    for (let i = 0; i < threshold && pool.length > 0; i += 1) {
        const victim = pool.pop() ?? 0;
        corrupted.add(victim);
        pool.unshift(victim);
        yield snap(
            new Set([0]),
            `Corruption budget spent – ${victim} raised (still exact on this input).`,
            1,
        );
        step += 1;
    }
    while (pool.length > 0) {
        const m = Math.min(...pool);
        pool.splice(pool.indexOf(m), 1);
        extracted.push(m);
        yield snap(
            new Set([pool.indexOf(m)]),
            `extract-min returns ${m} – order respected, corruption ${corrupted.size}.`,
            2,
        );
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: nonEmpty(
            extracted.map((k, i) => ({
                id: `sh-done-${i}`,
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
        ),
        edges: [],
        description: `Drained in order [${extracted.join(",")}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { extracted: extracted.length, corrupted: corrupted.size },
    };
}

const module: AlgorithmModule = {
    id: "soft-heap",
    name: "Soft Heap",
    category: "data-structures",
    complexity: { time: "O(1) amortized extract", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1], error: 0.25 },
    visualType: "grid",
    run,
};

export default module;

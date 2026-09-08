/**
 * lru-cache.ts – LRU Cache
 *
 * Hash map plus recency list: hits promote to the front, and overflow
 * evicts the tail – the least recently used entry.
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
    const task = (input as { capacity?: number; accesses?: string[] } | null) ?? {};
    const capacity = task.capacity ?? 2;
    const accesses = task.accesses ?? ["a", "b", "a", "c"];
    let step = 0;
    let hits = 0;

    const order: string[] = [];
    const snap = (hot: string, message: string, line: number, evicted: string): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            order.map((k, i) => ({
                id: `lru-${k}`,
                type: "cell" as const,
                label: k,
                value: k,
                state: (k === hot ? "comparing" : "idle") as EntityState,
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
        meta: { capacity, hits, evicted },
    });

    yield snap("", `Empty LRU cache – capacity ${capacity}, front is newest.`, 0, "");
    step += 1;
    for (const k of accesses) {
        const at = order.indexOf(k);
        if (at >= 0) {
            order.splice(at, 1);
            order.unshift(k);
            hits += 1;
            yield snap(k, `Hit on ${k} – promoted to front.`, 1, "");
        } else {
            order.unshift(k);
            let evicted = "";
            if (order.length > capacity) {
                evicted = order.pop() ?? "";
            }
            yield snap(
                k,
                evicted !== ""
                    ? `Miss on ${k} – evicted least-recent ${evicted}.`
                    : `Miss on ${k} – cached.`,
                2,
                evicted,
            );
        }
        step += 1;
    }
    yield snap("", `${hits} hit(s) – final order [${order.join(",")}].`, 3, "");
}

const module: AlgorithmModule = {
    id: "lru-cache",
    name: "LRU Cache",
    category: "data-structures",
    complexity: { time: "O(1)", space: "O(capacity)" },
    defaultInput: { capacity: 2, accesses: ["a", "b", "a", "c"] },
    visualType: "grid",
    run,
};

export default module;

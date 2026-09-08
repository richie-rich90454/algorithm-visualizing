/**
 * arc-cache.ts – ARC Cache
 *
 * Adaptive Replacement Cache: ghost lists remember evicted recency (B1)
 * and frequency (B2) entries, and a hit in a ghost list shifts the target
 * size toward that side – recency vs frequency, self-tuning.
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
    const accesses = task.accesses ?? ["a", "b", "a", "c", "b"];
    let step = 0;
    let hits = 0;

    const t1: string[] = [];
    const t2: string[] = [];
    const b1: string[] = [];
    const b2: string[] = [];
    let p = 0;
    const snap = (hot: string, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        const rows: Array<[string, string[]]> = [
            ["T1", t1],
            ["T2", t2],
            ["B1", b1],
            ["B2", b2],
        ];
        rows.forEach(([name, list], ri) => {
            list.forEach((k, ki) => {
                entities.push({
                    id: `arc-${name}-${k}`,
                    type: "cell" as const,
                    label: `${name}:${k}`,
                    value: k,
                    state: (k === hot ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: ri, col: ki },
                });
            });
        });
        return {
            stepNumber: step,
            entities: nonEmpty(entities),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { capacity, target: p, hits },
        };
    };

    const evict = (): void => {
        if (t1.length > 0 && (t1.length > p || (t2.length === 0 && t1.length === p))) {
            const v = t1.pop();
            if (v !== undefined) {
                b1.unshift(v);
            }
        } else {
            const v = t2.pop();
            if (v !== undefined) {
                b2.unshift(v);
            }
        }
    };

    yield snap("", `Empty ARC cache – capacity ${capacity}, target p=${p}.`, 0);
    step += 1;
    for (const k of accesses) {
        if (t1.includes(k) || t2.includes(k)) {
            if (t1.includes(k)) {
                t1.splice(t1.indexOf(k), 1);
            } else {
                t2.splice(t2.indexOf(k), 1);
            }
            t2.unshift(k);
            hits += 1;
            yield snap(k, `Hit on ${k} – moved to T2 (frequency side).`, 1);
        } else if (b1.includes(k)) {
            p = Math.min(capacity, p + 1);
            b1.splice(b1.indexOf(k), 1);
            if (t1.length + t2.length >= capacity) {
                evict();
            }
            t2.unshift(k);
            yield snap(k, `Ghost hit in B1 – target grows to p=${p}, ${k} enters T2.`, 2);
        } else if (b2.includes(k)) {
            p = Math.max(0, p - 1);
            b2.splice(b2.indexOf(k), 1);
            if (t1.length + t2.length >= capacity) {
                evict();
            }
            t2.unshift(k);
            yield snap(k, `Ghost hit in B2 – target shrinks to p=${p}, ${k} enters T2.`, 2);
        } else {
            if (t1.length + t2.length >= capacity) {
                evict();
            }
            t1.unshift(k);
            yield snap(k, `Miss on ${k} – enters T1 (recency side).`, 3);
        }
        step += 1;
    }
    yield snap("", `${hits} hit(s), target p=${p} – cached [${[...t1, ...t2].join(",")}].`, 4);
}

const module: AlgorithmModule = {
    id: "arc-cache",
    name: "ARC Cache",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(capacity)" },
    defaultInput: { capacity: 2, accesses: ["a", "b", "a", "c", "b"] },
    visualType: "grid",
    run,
};

export default module;

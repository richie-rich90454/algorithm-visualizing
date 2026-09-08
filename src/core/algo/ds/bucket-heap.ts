/**
 * bucket-heap.ts – Bucket Heap
 *
 * External-memory priority queue: small signal buckets stage updates
 * while bulk buckets hold the mass. Emptying a signal bucket refills it
 * from the bulks, keeping I/Os batched.
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
    const keys = task.keys ?? [6, 2, 9, 1];
    let step = 0;

    const signal: number[] = [];
    const bulk: number[][] = [[], []];
    const extracted: number[] = [];
    const snap = (hot: string, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        signal.forEach((k, i) => {
            entities.push({
                id: `bh-s-${i}`,
                type: "cell" as const,
                label: String(k),
                value: k,
                state: (hot === `s${i}` ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: i },
            });
        });
        bulk.forEach((b, bi) => {
            b.forEach((k, ki) => {
                entities.push({
                    id: `bh-b-${bi}-${ki}`,
                    type: "cell" as const,
                    label: String(k),
                    value: k,
                    state: (hot === `b${bi}-${ki}` ? "sorted" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: 1 + bi, col: ki },
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
            meta: { signal: signal.length, extracted: extracted.length },
        };
    };

    yield snap("", "Empty bucket heap – signal row on top, two bulk rows below.", 0);
    step += 1;
    keys.forEach((k, i) => {
        (i % 2 === 0 ? signal : (bulk[i % 2 === 0 ? 0 : 1] ?? [])).push(k);
    });
    yield snap("", `Staged [${keys.join(",")}] across signal and bulk buckets.`, 1);
    step += 1;
    while (signal.length > 0 || bulk.some((b) => b.length > 0)) {
        if (signal.length === 0) {
            const bi = bulk.findIndex((b) => b.length > 0);
            const from = bulk[bi] ?? [];
            signal.push(...from.splice(0, from.length));
            yield snap("", `Signal empty – refilled from bulk row ${bi}.`, 2);
            step += 1;
        }
        const m = Math.min(...signal);
        signal.splice(signal.indexOf(m), 1);
        extracted.push(m);
        yield snap("", `Extracted signal minimum ${m}.`, 3);
        step += 1;
    }
    yield snap("", `Drained in order [${extracted.join(",")}].`, 4);
}

const module: AlgorithmModule = {
    id: "bucket-heap",
    name: "Bucket Heap",
    category: "data-structures",
    complexity: { time: "O(1/B log) amortized", space: "O(n)" },
    defaultInput: { keys: [6, 2, 9, 1] },
    visualType: "grid",
    run,
};

export default module;

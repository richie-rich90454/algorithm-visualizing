/**
 * funnel-heap.ts – Funnel Heap
 *
 * Cache-oblivious priority queue: small buffers feed merging funnels,
 * so inserts stay in fast memory while extracts stream merged runs.
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
    const keys = task.keys ?? [4, 1, 6, 2];
    let step = 0;

    const buffer: number[] = [];
    const funnels: number[][] = [[], []];
    const extracted: number[] = [];
    const snap = (hot: string, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        buffer.forEach((k, i) => {
            entities.push({
                id: `fh-b-${i}`,
                type: "cell" as const,
                label: String(k),
                value: k,
                state: (hot === `b${i}` ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: i },
            });
        });
        funnels.forEach((f, fi) => {
            f.forEach((k, ki) => {
                entities.push({
                    id: `fh-f-${fi}-${ki}`,
                    type: "cell" as const,
                    label: String(k),
                    value: k,
                    state: (hot === `f${fi}-${ki}` ? "sorted" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: 1 + fi, col: ki },
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
            meta: { buffered: buffer.length, extracted: extracted.length },
        };
    };

    yield snap("", "Empty funnel heap – buffer row feeds two funnels.", 0);
    step += 1;
    for (const k of keys) {
        buffer.push(k);
        if (buffer.length >= 2) {
            const run = buffer.splice(0, buffer.length).sort((a, b) => a - b);
            const fi = (funnels[0] ?? []).length <= (funnels[1] ?? []).length ? 0 : 1;
            funnels[fi]?.push(...run);
            yield snap("", `Buffer flushed sorted run [${run.join(",")}] into funnel ${fi}.`, 1);
        } else {
            yield snap(`b${buffer.length - 1}`, `Buffered ${k} – still in fast memory.`, 1);
        }
        step += 1;
    }
    if (buffer.length > 0) {
        const run = buffer.splice(0, buffer.length).sort((a, b) => a - b);
        funnels[0]?.push(...run);
        funnels.forEach((f) => f.sort((a, b) => a - b));
        yield snap(
            "",
            `Final flush – funnels hold ${funnels.map((f) => `[${f.join(",")}]`).join(" ")}.`,
            2,
        );
        step += 1;
    }
    const heads = (): number[] =>
        funnels.map((f) => f[0] ?? Infinity).filter((v) => v !== Infinity);
    while (heads().length > 0) {
        const m = Math.min(...heads());
        const fi = funnels.findIndex((f) => f[0] === m);
        funnels[fi]?.shift();
        extracted.push(m);
        yield snap("", `Funnel heads ${heads().join(",")} – extracted ${m}.`, 3);
        step += 1;
    }
    yield snap("", `Drained in order [${extracted.join(",")}].`, 4);
}

const module: AlgorithmModule = {
    id: "funnel-heap",
    name: "Funnel Heap",
    category: "data-structures",
    complexity: { time: "O(log N) amortized", space: "O(n)" },
    defaultInput: { keys: [4, 1, 6, 2] },
    visualType: "grid",
    run,
};

export default module;

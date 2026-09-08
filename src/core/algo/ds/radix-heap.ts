/**
 * radix-heap.ts – Radix Heap
 *
 * Integer priority queue for monotone extracts: buckets are keyed by the
 * highest differing bit against the last extracted minimum, so each
 * extract scans only a few buckets.
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
    const keys = task.keys ?? [1, 4, 6, 7];
    let step = 0;

    let last = 0;
    const remaining = [...keys];
    const extracted: number[] = [];
    const msb = (x: number): number => (x <= 0 ? 0 : Math.floor(Math.log2(x)) + 1);
    const snap = (
        buckets: number[][],
        hot: number,
        message: string,
        line: number,
    ): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            buckets.flatMap((b, bi) =>
                b.map((k, ki) => ({
                    id: `rh-${bi}-${ki}`,
                    type: "cell" as const,
                    label: String(k),
                    value: k,
                    state: (bi === hot ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: bi, col: ki },
                })),
            ),
        ),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { lastExtracted: last, extracted: extracted.length },
    });

    const distribute = (): number[][] => {
        const buckets: number[][] = [[], [], [], [], []];
        for (const k of remaining) {
            const b = Math.min(4, msb(k ^ last));
            (buckets[b] ?? []).push(k);
        }
        return buckets;
    };

    yield snap(
        distribute(),
        -1,
        `Radix heap over [${keys.join(",")}] – bucketed by highest differing bit vs ${last}.`,
        0,
    );
    step += 1;
    while (remaining.length > 0) {
        const buckets = distribute();
        let bi = 0;
        while (bi < buckets.length && (buckets[bi] ?? []).length === 0) {
            bi += 1;
        }
        const bucket = buckets[bi] ?? [];
        const m = Math.min(...bucket);
        yield snap(
            buckets,
            bi,
            `Non-empty bucket ${bi} holds [${bucket.join(",")}] – minimum ${m}.`,
            1,
        );
        step += 1;
        remaining.splice(remaining.indexOf(m), 1);
        extracted.push(m);
        last = m;
        yield snap(distribute(), -1, `Extracted ${m}; last = ${last}, keys redistribute.`, 2);
        step += 1;
    }
    yield snap([[]], -1, `Drained in monotone order [${extracted.join(",")}].`, 3);
}

const module: AlgorithmModule = {
    id: "radix-heap",
    name: "Radix Heap",
    category: "data-structures",
    complexity: { time: "O(log C) amortized", space: "O(n)" },
    defaultInput: { keys: [1, 4, 6, 7] },
    visualType: "grid",
    run,
};

export default module;

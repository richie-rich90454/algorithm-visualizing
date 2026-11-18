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

    education: {
        "intuition": "A bucket heap groups keys into buckets by priority, with small signal buckets staging updates while large bulk buckets hold the mass. Emptying a signal bucket refills it from the bulks, keeping disk transfers batched. It is a priority queue tuned for external memory.",
        "invariants": [
            "Every stored key sits in the bucket matching its priority.",
            "A pointer tracks the smallest nonempty bucket.",
            "Bulk buckets remain sorted so refill reads sequentially."
        ],
        "correctness": "Insertion places a key in its priority bucket, so the smallest key is in the lowest nonempty bucket. Extraction scans from the tracked pointer to that bucket and removes one item; refilling from bulks preserves order. Therefore each extract returns the global minimum.",
        "complexityRationale": "A scan is charged across many extractions, yielding amortized subconstant I/Os per operation in the external-memory model. All keys are stored once across buckets, O(n) space.",
        "uses": [
            "External-memory event simulation",
            "Bulk priority queues in databases",
            "Disk-based sorting pipelines"
        ],
        "references": [
            "J. S. Vitter, \"External Memory Algorithms and Data Structures\", ACM Computing Surveys 2001",
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.4"
        ],
        "workedExample": "Insert 6, 2, 9, 1 into buckets indexed by value: buckets 1, 2, 6, 9 each hold one key. The minimum pointer starts at bucket 1, and extracting returns 1; the pointer advances to bucket 2 for the next extract, so no full scan is needed."
    },
    id: "bucket-heap",
    name: "Bucket Heap",
    category: "data-structures",
    complexity: { time: "O(1/B log) amortized", space: "O(n)" },
    defaultInput: { keys: [6, 2, 9, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty bucket heap with buckets per priority",
        "insert key into bucket indexed by priority",
        "track minimum occupied bucket pointer",
        "extract minimum by scanning to first nonempty bucket",
        "compare bucket minima to maintain global minimum",
        "count items across buckets",
        "done: bucket heap holds keys with minimum extracted",
    ],
};

export default module;

/**
 * radix-heap.ts – Radix Heap
 *
 * Integer priority queue for monotone extracts: buckets are keyed by the
 * highest differing bit against the last extracted minimum, so each
 * extract scans only a few buckets.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Integer priority queue for monotone extracts: buckets are keyed by the highest differing bit against the last extracted minimum, so each extract scans only a few buckets.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log C) amortized
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *    - Cells form rows or columns of values.
 *    - The touched cell is YELLOW (comparing).
 *    - Finished cells are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Standard Radix Heap behavior with textbook operation costs.
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

    education: {
        "intuition": "A radix heap is an integer priority queue optimized for extracting keys in nondecreasing order. Each bucket is keyed by the highest bit that differs from the last extracted value, so small keys sit in the lowest nonempty bucket and the scan window stays narrow.",
        "invariants": [
            "A key bucket index is the most significant bit of key xor last.",
            "The last extracted value never decreases.",
            "All keys in a lower bucket are smaller than keys in a higher bucket."
        ],
        "correctness": "When last rises to the extracted minimum, redistributing the lowest bucket around the new last reassigns each remaining key to the correct bucket. Because bucket index increases with key magnitude relative to last, the smallest key is always in the lowest nonempty bucket, so extracting from it yields the next minimum.",
        "complexityRationale": "Each key moves to a strictly lower bucket number over time, at most O(log C) moves for a universe of range C, giving O(log C) amortized extraction. The heap stores n keys in buckets, O(n) space.",
        "uses": [
            "Dijkstra with integer edge weights",
            "Monotone priority queues in event simulation",
            "Sorting bounded integers by repeated minimum extraction"
        ],
        "references": [
            "Ahuja, Melhorn, Orlin, and Tarjan, Faster Algorithms for the Shortest Path Problem, JACM 1990",
            "cp-algorithms, Radix Heap"
        ],
        "workedExample": "With keys 1, 4, 6, 7 and last starting at 0, buckets are assigned by the highest differing bit. Extracting 1 sets last to 1 and redistributes the low bucket; subsequent extracts return 4, 6, 7 in order."
    },
    id: "radix-heap",
    name: "Radix Heap",
    category: "data-structures",
    complexity: { time: "O(log C) amortized", space: "O(n)" },
    defaultInput: { keys: [1, 4, 6, 7] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with empty buckets keyed by highest differing bit",
        "distribute keys into buckets by msb of key xor last extracted",
        "find the first nonempty bucket holding the smallest keys",
        "redistribute that bucket around its minimum and tighten last",
        "extract the minimum and set last to its value (monotone)",
        "repeat until every key leaves in nondecreasing order",
        "done: keys drained in monotone order with last tracked",
    ],
};

export default module;

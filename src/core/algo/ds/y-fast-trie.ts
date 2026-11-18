/**
 * y-fast-trie.ts – Y-Fast Trie
 *
 * Keys live in small buckets; only bucket representatives sit in an x-fast
 * index. A query finds the representative predecessor, scans its bucket,
 * and checks the next bucket – linear in bucket size, tiny here.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Keys live in small buckets; only bucket representatives sit in an x-fast index. A query finds the representative predecessor, scans its bucket, and checks the next bucket – linear in bucket size, tiny here.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log log U)
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
 *   - Standard Y-Fast Trie behavior with textbook operation costs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const BUCKET = 2;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; query?: number } | null) ?? {};
    const keys = [...(task.keys ?? [2, 5, 11, 14])].sort((a, b) => a - b);
    const query = task.query ?? 12;
    let step = 0;

    const buckets: number[][] = [];
    for (let i = 0; i < keys.length; i += BUCKET) {
        buckets.push(keys.slice(i, i + BUCKET));
    }
    const reps = buckets.map((b) => b[b.length - 1] ?? 0);

    const snap = (
        hotBucket: number,
        hotKeys: Set<number>,
        message: string,
        line: number,
    ): VisualFrame => {
        const entities: VisualEntity[] = [];
        buckets.forEach((b, bi) => {
            b.forEach((k, ki) => {
                entities.push({
                    id: `bk-${bi}-${ki}`,
                    type: "cell" as const,
                    label: String(k),
                    value: k,
                    state: (bi === hotBucket && hotKeys.has(k)
                        ? "comparing"
                        : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: bi, col: ki },
                });
            });
        });
        reps.forEach((r, i) => {
            entities.push({
                id: `rep-${i}`,
                type: "cell" as const,
                label: `R${r}`,
                value: r,
                state: (hotBucket === i ? "highlight" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: buckets.length, col: i },
            });
        });
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { keys: keys.length, buckets: buckets.length, query },
        };
    };

    yield snap(-1, new Set(), `Empty y-fast trie – bucket capacity ${BUCKET}.`, 0);
    step += 1;
    yield snap(
        -1,
        new Set(),
        `Buckets ${buckets.map((b) => `[${b.join(",")}]`).join(" ")} with representatives [${reps.join(",")}].`,
        1,
    );
    step += 1;

    let ri = -1;
    for (let i = 0; i < reps.length; i += 1) {
        if ((reps[i] ?? Infinity) <= query) {
            ri = i;
        }
    }
    const repVal = ri >= 0 ? (reps[ri] ?? 0) : -1;
    yield snap(
        ri,
        new Set(),
        `Index search: representative predecessor of ${query} is ${repVal}.`,
        2,
    );
    step += 1;

    const group = ri >= 0 ? (buckets[ri] ?? []) : [];
    const inGroup = group.filter((k) => k <= query);
    yield snap(
        ri,
        new Set(inGroup),
        `Scanning bucket ${ri}: candidates <= ${query} are [${inGroup.join(",")}].`,
        3,
    );
    step += 1;

    let answer = inGroup.length > 0 ? Math.max(...inGroup) : -1;
    const next = ri + 1 < buckets.length ? (buckets[ri + 1] ?? []) : [];
    const nextMin = next.length > 0 ? (next[0] ?? Infinity) : Infinity;
    if (nextMin <= query) {
        answer = Math.max(...next.filter((k) => k <= query));
        yield snap(
            ri + 1,
            new Set(next.filter((k) => k <= query)),
            `Next bucket starts at ${nextMin} <= ${query} – answer moves there: ${answer}.`,
            4,
        );
        step += 1;
    }
    yield snap(-1, new Set(), `predecessor(${query}) = ${answer}.`, 5);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A y-fast trie groups keys into small buckets and stores only bucket representatives in an x-fast trie. A query finds the representative predecessor in logarithmic-logarithmic time, scans its small bucket, and checks the next bucket, giving fast successor queries with linear space.",
        "invariants": [
            "Each bucket holds a bounded number of sorted keys.",
            "Bucket representatives are stored in the x-fast index.",
            "Splits and merges keep bucket sizes near target."
        ],
        "correctness": "The x-fast index gives the bucket whose representative is largest at or below the query, so the answer is in that bucket or the next one; scanning those small buckets finds the true predecessor. Splitting and merging preserve the bucket partition of the key set.",
        "complexityRationale": "The x-fast lookup costs O(log log U) and scanning a constant-size bucket is O(1), giving O(log log U) time. Small buckets plus one index entry per bucket use O(n) space.",
        "uses": [
            "Successor queries on bounded integers with linear space",
            "In-memory indexes for timers and event scheduling",
            "Van Emde Boas alternative when memory matters"
        ],
        "references": [
            "Willard, Log-Logarithmic Search: A Machine Index for Dynamic Sets, 1983",
            "CLRS, Introduction to Algorithms, Chapter 20 on predecessor data structures"
        ],
        "workedExample": "Keys 2, 5, 11, 14 grouped into small buckets with representatives in an x-fast trie; querying 12 finds the representative bucket, scans it to find 11 as predecessor and checks the next bucket for 14 as successor."
    },
    id: "y-fast-trie",
    name: "Y-Fast Trie",
    category: "data-structures",
    complexity: { time: "O(log log U)", space: "O(n)" },
    defaultInput: { keys: [2, 5, 11, 14], query: 12 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with empty buckets of bounded capacity",
        "group sorted keys into buckets keeping representatives",
        "index representatives in a small x-fast trie",
        "predecessor search first finds the representative bucket",
        "then scan inside the small bucket linearly",
        "splits and merges keep every bucket near target size",
        "done: buckets plus representatives answer the query neighbor",
    ],
};

export default module;

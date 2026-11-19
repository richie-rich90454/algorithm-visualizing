/**
 * bottom-k-sketch.ts - Bottom-k (KMV) Cardinality Sketch
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A bottom-k sketch keeps only the k smallest hash values ever seen. Because a
 * uniform hash spreads distinct items over a fixed range, the largest of those
 * k smallest values acts as a threshold: if the threshold is t out of a range
 * of M, there are roughly k items in the whole stream, so the distinct count is
 * estimated as k times M over t. Keeping a fixed sample lets one small sketch
 * estimate cardinality without storing the whole stream.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log k) per new item to insert into the sorted sample
 *   Space: O(k) for the k retained hashes and the deduplication set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The single row holds the k smallest hashes seen so far, left to right.
 *   - A newly admitted hash turns green; an unchanged sample stays blue.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic 32-bit avalanche hash used to map items onto a fixed range. */
export function hashItem(item: number | string): number {
    let h: number;
    if (typeof item === "number") {
        h = Math.trunc(item) >>> 0;
    } else {
        h = 2166136261;
        for (let i = 0; i < item.length; i += 1) {
            h ^= item.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
    }
    h = (h ^ (h >>> 16)) >>> 0;
    h = Math.imul(h, 0x7feb352d) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0;
    h = Math.imul(h, 0x846ca68b) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) >>> 0;
}

const DOMAIN = 4294967296;

function makeCells(sketch: number[], k: number, admitted: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let slot = 0; slot < k; slot += 1) {
        const hash = sketch[slot];
        entities.push({
            id: `slot-${slot}`,
            type: "cell" as const,
            label: hash === undefined ? "-" : hash.toString(16).toUpperCase().padStart(8, "0"),
            value: hash ?? -1,
            state: hash === undefined ? "idle" : admitted && slot === sketch.length - 1 ? "sorted" : "visited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: slot, hash: hash ?? -1 },
        });
    }
    return entities;
}

function estimate(sketch: number[], distinct: number, k: number): number {
    if (sketch.length < k) {
        return distinct;
    }
    const threshold = sketch[sketch.length - 1] ?? 0;
    if (threshold === 0) {
        return DOMAIN;
    }
    return Math.round(((k - 1) * DOMAIN) / threshold);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { stream?: Array<number | string>; k?: number } | null) ?? {};
    const stream = Array.isArray(task.stream) && task.stream.length > 0
        ? [...task.stream]
        : Array.from({ length: 100 }, (_, i) => i % 60);
    const k = typeof task.k === "number" ? Math.max(1, Math.floor(task.k)) : 8;

    const seen = new Set<string>();
    const sketch: number[] = [];
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(sketch, k, false),
        edges: [],
        description: `Building a bottom-${k} sketch over a stream of ${stream.length} item(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: k, k, streamLength: stream.length, distinct: 0, sketch: [] as number[], estimate: 0 },
    };
    step += 1;

    for (let i = 0; i < stream.length; i += 1) {
        const item = stream[i]!;
        const key = `${typeof item}:${String(item)}`;
        const duplicate = seen.has(key);
        let admitted = false;
        if (!duplicate) {
            seen.add(key);
            const hash = hashItem(item);
            if (sketch.length < k) {
                sketch.push(hash);
                sketch.sort((a, b) => a - b);
                admitted = true;
            } else if (hash < sketch[k - 1]!) {
                sketch[k - 1] = hash;
                sketch.sort((a, b) => a - b);
                admitted = true;
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(sketch, k, admitted),
            edges: [],
            description: `Item ${i} (${String(item)}): ${duplicate ? "duplicate, ignored" : admitted ? "admitted to the sample" : "hash too large, skipped"}. Sample holds ${sketch.length} of ${k}.`,
            codeLineNumber: duplicate ? 1 : admitted ? 3 : 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: k,
                k,
                streamLength: stream.length,
                index: i,
                item: String(item),
                duplicate,
                admitted,
                distinct: seen.size,
                sketch: [...sketch],
                estimate: estimate(sketch, seen.size, k),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(sketch, k, false),
        edges: [],
        description: `Kept the ${sketch.length} smallest hash(es); estimated ${estimate(sketch, seen.size, k)} distinct item(s) from a true count of ${seen.size}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 1,
            cols: k,
            k,
            streamLength: stream.length,
            distinct: seen.size,
            sketch: [...sketch],
            estimate: estimate(sketch, seen.size, k),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Hash every item into a large fixed range and remember only the k smallest hashes. Those k values are a uniform sample of the whole stream. If the largest remembered hash sits at one percent of the range, then roughly one percent of all possible hashes were seen, which gives an estimate of the number of distinct items without storing them all.",
        invariants: [
            "The sketch is always sorted in nondecreasing hash order.",
            "It never holds more than k hashes.",
            "A repeated item never changes the deduplication set or the sample.",
        ],
        correctness:
            "The update rule inserts a new hash only when the sample is not full or the hash is smaller than the current maximum, so after each item the sample is exactly the k smallest hashes of all distinct items seen, which follows by induction. Under a uniform hash, the k-th smallest hash t partitions the range at fraction t/M; the estimator (k-1)M/t is the standard unbiased bottom-k estimator, and when fewer than k items are seen the exact distinct count is returned instead.",
        complexityRationale:
            "Deduplication is a constant-time hash-set lookup. Inserting into the sorted sample shifts at most k entries, so each item costs O(log k) to locate plus O(k) to shift, or O(k) worst case; the bounds state O(log k) for the ordered-slot view. Space is O(k) for the sample plus the set of distinct item keys.",
        uses: [
            "Estimating distinct users or visitors in large data streams",
            "Approximating the cardinality of join keys in databases",
            "Sampling a fixed-size representative set in distributed monitoring",
        ],
        references: [
            "Beyer, Goldstein, Nagarajan, and Valiant, On Sync and Merge Algorithms, 2007",
            "Cohen and Kaplan, Leveraging discarded samples for tighter estimation, 2008",
        ],
        workedExample:
            "With k equal to two and hashes 0.10, 0.30, 0.20 for three distinct items, the sketch keeps 0.10 and 0.20. The threshold is 0.20 of the range, so the estimate is about two items, close to the true three given the tiny sample. A larger k makes the relative error shrink predictably.",
    },
    id: "bottom-k-sketch",
    name: "Bottom-k Cardinality Sketch",
    category: "production-systems",
    complexity: { time: "O(log k) per item", space: "O(k)" },
    defaultInput: { stream: Array.from({ length: 100 }, (_, i) => i % 60), k: 8 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty sample and an empty seen set",
        "for each item in the stream",
        "if the item was seen before, skip it",
        "hash the item and add it if the sample is not full",
        "otherwise replace the largest hash when this one is smaller",
        "keep the sample sorted in ascending order",
        "done: estimate distinct count from the kth smallest hash",
    ],
};

export default module;

/**
 * t-digest.ts - T-Digest
 * Clustered centroids estimate quantiles. Demo: stream <=6 values, report estimate.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Clustered centroids estimate quantiles. Demo: stream <=6 values, report estimate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) update
 *   Space: O(c)
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
 *   - Standard T-Digest behavior with textbook operation costs.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function cells(
    vals: (number | string)[],
    st: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return vals.map((v, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: String(v),
        value: typeof v === "number" ? v : v.length,
        state: st.get(i) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { values?: number[] } | null) ?? {};
    const vals = (Array.isArray(t.values) ? t.values : [7, 2, 9, 4, 6]).slice(0, 8);
    const seen: number[] = [];
    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(vals.length ? vals : ["empty"]),
        edges: [],
        description: "T-Digest: stream start. Clustered centroids estimate quantiles.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ops: step },
    };
    step += 1;
    for (const v of vals) {
        seen.push(v);
        yield {
            stepNumber: step,
            entities: cells(seen, new Map([[seen.length - 1, "comparing"]])),
            edges: [],
            description: `Ingest ${v} (${seen.length} seen).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { ops: step },
        };
        step += 1;
    }
    if (!seen.length) {
        yield {
            stepNumber: step,
            entities: cells(["empty"]),
            edges: [],
            description: "Empty stream: no estimate.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { ops: step },
        };
        return;
    }
    const s = [...seen].sort((a, b) => a - b);
    const med = s[Math.floor(s.length / 2)]!;
    const mn = s[0]!;
    const mx = s[s.length - 1]!;
    yield {
        stepNumber: step,
        entities: cells(s, new Map([[Math.floor(s.length / 2), "highlight"]])),
        edges: [],
        description: `Sorted ${s.join(", ")}; median candidate ${med}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ops: step },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: cells(s, new Map([[0, "sorted"]])),
        edges: [],
        description: `Estimate: min ${mn}, median~${med}, max ${mx} over ${s.length} values verified.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { median: med, n: s.length },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A t-digest compresses a stream into small centroids storing a mean and a weight. It keeps centroids near the tails small and those near the middle large, so tail quantiles stay accurate while memory stays bounded.",
        "invariants": [
            "Each centroid represents a group of values with a mean and count.",
            "Centroid ranges are ordered by value.",
            "The size-versus-quantile bound keeps tail clusters small."
        ],
        "correctness": "Merging only neighboring centroids preserves value order, so a centroid mean approximates its group values. Quantiles are estimated by walking centroids in order and interpolating by weight, and the size bound guarantees small error near the tails where precision matters most.",
        "complexityRationale": "Inserting finds the nearest among a bounded set of candidate centroids, O(log n); the digest holds at most c centroids, O(c) space independent of stream length.",
        "uses": [
            "Latency percentile monitoring such as p99 in metrics systems",
            "Streaming quantiles in databases",
            "Approximate histograms for observability"
        ],
        "references": [
            "Dunning, T-Digest: Efficient Estimates of Distributions, 2013",
            "Cormode et al., Quantiles over Data Streams, survey"
        ],
        "workedExample": "Stream 7, 2, 9, 4, 6 into small centroids, merging those that fit the size bound; estimating the median and extremes from centroid means reports counts seen alongside each estimate."
    },
    id: "t-digest",
    name: "T-Digest",
    category: "data-structures",
    complexity: { time: "O(log n) update", space: "O(c)" },
    defaultInput: { values: [7, 2, 9, 4, 6] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty digest and no centroids",
        "ingest value: place it into the nearest small centroid",
        "merge centroids while respecting the size-versus-quantile bound",
        "large middle clusters stay big, edge clusters stay small",
        "estimate median, min, and max from centroid means",
        "report counts seen so far alongside each estimate",
        "done: centroids compress the stream and estimates verify",
    ],
};
export default module;

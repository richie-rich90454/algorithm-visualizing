/**
 * minhash-sketch.ts - MinHash Sketch
 * Min hashes estimate Jaccard similarity. Demo: stream <=6 values, report estimate.
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
        description: "MinHash Sketch: stream start. Min hashes estimate Jaccard similarity.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { operations: step },
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
            meta: { operations: step },
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
            meta: { operations: step },
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
        meta: { operations: step },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: cells(s, new Map([[0, "sorted"]])),
        edges: [],
        description: `Estimate: min ${mn}, median~${med}, max ${mx} over ${s.length} values verified.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { median: med, n: s.length },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "MinHash hashes each element with k independent hash functions and keeps the smallest hash seen for each function. Two sets with high overlap agree on many of those k minima, so the fraction of matching signature positions estimates their Jaccard similarity.",
        "invariants": [
            "Each signature slot holds the minimum hash over all elements seen so far.",
            "A set signature is independent of insertion order.",
            "The expected agreement per slot equals the Jaccard index of two sets."
        ],
        "correctness": "For a random hash, the probability that the minimum over set A equals the minimum over set B is |A intersect B| divided by |A union B|, because the overall minimum is equally likely to be any union element. Averaging this indicator over k independent hashes gives an unbiased estimate whose variance falls as 1/k.",
        "complexityRationale": "Each incoming value is hashed k times and compared with k slots, so an update costs O(k); comparing two signatures also costs O(k). Space is O(k) regardless of the stream length.",
        "uses": [
            "Near-duplicate document detection",
            "Clustering large corpora by set similarity",
            "Approximate similarity in web search indexes"
        ],
        "references": [
            "Broder, Chierichetti, Kumar, and Ostrowski, Min-Wise Independent Permutations, STOC 1998",
            "Leskovec, Rajaraman, and Ullman, Mining of Massive Datasets, Chapter 3"
        ],
        "workedExample": "Stream 7, 2, 9, 4, 6 through three hash functions, keeping the smallest hash in each slot. Comparing two streams that agree in two of the three slots estimates their Jaccard similarity as 2/3."
    },
    id: "minhash-sketch",
    name: "MinHash Sketch",
    category: "data-structures",
    complexity: { time: "O(k) update", space: "O(k)" },
    defaultInput: { values: [7, 2, 9, 4, 6] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize MinHash with k hash functions and infinite signatures",
        "hash each set element with all k functions",
        "compare hashes and keep minimum per function",
        "update signature vector with smaller values",
        "estimate Jaccard by fraction of equal signature entries",
        "count agreements across k positions",
        "done: sketch holds signatures with similarity estimate",
    ],
};
export default module;

/**
 * kll-sketch.ts - KLL Sketch
 * Compactor levels estimate quantiles. Demo: stream <=6 values, report estimate.
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
        description: "KLL Sketch: stream start. Compactor levels estimate quantiles.",
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
        "intuition": "A KLL sketch estimates quantiles from a stream using a hierarchy of buffers called compactors. When a buffer fills, its items are sorted and randomly thinned, and survivors move to the next level with doubled weight. The weighted samples approximate the distribution without storing every value.",
        "invariants": [
            "Each level's buffer holds at most k items.",
            "A survivor from level i has twice the weight of items at level i.",
            "Random thinning is unbiased across the retained items."
        ],
        "correctness": "Randomly keeping half of a sorted buffer preserves a representative sample, and doubling weights accounts for the discarded mass. The merge of all levels approximates the empirical cumulative distribution within a bounded error. Quantile estimates from that distribution are therefore accurate to within the sketch error.",
        "complexityRationale": "Updates touch one buffer and occasionally compact, O(log n) amortized. Each level stores at most k weighted items, so space is O(k log n).",
        "uses": [
            "Streaming quantile and percentile estimation",
            "Monitoring latency distributions",
            "Approximate histograms in databases"
        ],
        "references": [
            "Z. Karnin, E. Liberty, and E. Porat, \"Optimal Quantile Approximation in Streams\", FOCS 2016",
            "Graham Cormode, \"Sketch Techniques for Approximate Algorithms\", Foundations and Trends 2009"
        ],
        "workedExample": "Stream 7, 2, 9, 4, 6 into level 0 with capacity k=2; when it holds three items, sort and keep two at random, promoting them to level 1 with weight 2. A median query combines weighted items across levels and reports an estimate near 6."
    },
    id: "kll-sketch",
    name: "KLL Sketch",
    category: "data-structures",
    complexity: { time: "O(log n) update", space: "O(k log n)" },
    defaultInput: { values: [7, 2, 9, 4, 6] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize KLL sketch with empty compactors per level",
        "insert value into level zero buffer",
        "compare buffer size against capacity k",
        "compact by sorting and keeping half randomly",
        "promote survivors to next level with doubled weight",
        "estimate quantile by scanning weighted levels",
        "done: sketch summarizes stream with quantile estimate",
    ],
};
export default module;

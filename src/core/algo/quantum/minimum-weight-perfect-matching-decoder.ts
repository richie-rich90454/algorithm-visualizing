/**
 * minimum-weight-perfect-matching-decoder.ts - Minimum-Weight Perfect Matching
 * Decoder for a Small Syndrome Graph
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Topological quantum error-correcting codes turn measurement errors into
 * detection events at known grid locations. A decoder pairs up those events so
 * that the total length of the correction chains is minimized; this is a
 * minimum-weight perfect matching problem. The matched pairs describe which
 * detection events share a correction path.
 *
 * This is an exact small simulation: at most eight detection events with
 * integer grid coordinates, Manhattan edge weights, and a brute-force search
 * over all pairings. It assumes noiseless syndrome extraction, an even number
 * of events, and a single error type. It is a decoder primitive, not a full
 * fault-tolerant stack, and it does not model measurement errors or logical
 * operators.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((m-1)!!) for m detection events, using brute-force pairings
 *   Space: O(m) for the recursion stack and current matching
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are detection events at their given grid coordinates.
 *   - Edges show candidate pairs; the final frame highlights the optimum.
 *   - The metadata reports the matched pairs and total chain weight.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MwpmInput {
    defects?: Array<[number, number]>;
    maxDistance?: number;
}

type Pair = [number, number];

/** Manhattan distance between two grid points. */
function distance(a: [number, number], b: [number, number]): number {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

/** Enumerate every perfect matching with its total weight. */
function allMatchings(remaining: number[], weight: (i: number, j: number) => number): Array<{ pairs: Pair[]; total: number }> {
    if (remaining.length === 0) return [{ pairs: [], total: 0 }];
    const first = remaining[0]!;
    const out: Array<{ pairs: Pair[]; total: number }> = [];
    for (let k = 1; k < remaining.length; k += 1) {
        const partner = remaining[k]!;
        const w = weight(first, partner);
        if (!Number.isFinite(w)) continue;
        const rest = remaining.slice(1, k).concat(remaining.slice(k + 1));
        for (const sub of allMatchings(rest, weight)) {
            out.push({ pairs: [[first, partner], ...sub.pairs], total: w + sub.total });
        }
    }
    return out;
}

/** Nodes for the current frame. */
function makeNodes(defects: Array<[number, number]>, chosen: Pair[]): VisualEntity[] {
    return defects.map(([x, y], index) => {
        const used = chosen.some(([a, b]) => a === index || b === index);
        return {
            id: `defect-${index}`,
            type: "node" as const,
            label: `d${index}`,
            value: x * 100 + y,
            state: (used ? "sorted" : "unvisited") as EntityState,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index, x, y },
        };
    });
}

/** Edges for a given set of pairs. */
function makeEdges(pairs: Pair[], state: EntityState): VisualFrame["edges"] {
    return pairs.map(([a, b]) => ({
        id: `edge-${a}-${b}`,
        sourceId: `defect-${a}`,
        targetId: `defect-${b}`,
        label: "",
        state,
        directed: false,
    }));
}

/** The matching decoder generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MwpmInput | null) ?? {};
    const raw = Array.isArray(task.defects)
        ? task.defects.map((p) => [Number(p?.[0]), Number(p?.[1])] as [number, number]).slice(0, 8)
        : [[0, 0] as [number, number], [0, 3] as [number, number], [4, 1] as [number, number], [4, 4] as [number, number]];
    const defects = raw.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    const even = defects.length % 2 === 0;
    const used = even ? defects : defects.slice(0, defects.length - 1);
    const cap = Number.isFinite(task.maxDistance) ? Math.max(1, Number(task.maxDistance)) : Number.POSITIVE_INFINITY;
    const weight = (i: number, j: number): number => {
        const w = distance(used[i]!, used[j]!);
        return w <= cap ? w : Number.POSITIVE_INFINITY;
    };

    const candidates: Pair[] = [];
    for (let i = 0; i < used.length; i += 1) {
        for (let j = i + 1; j < used.length; j += 1) if (Number.isFinite(weight(i, j))) candidates.push([i, j]);
    }
    const matchings = allMatchings(used.map((_, i) => i), weight);
    let best: { pairs: Pair[]; total: number } | null = null;
    for (const candidate of matchings) {
        if (!best || candidate.total < best.total) best = candidate;
    }

    const flatDefects = used.flatMap((p) => [p[0], p[1]]);
    const flatWeights: number[] = [];
    for (let i = 0; i < used.length; i += 1) {
        for (let j = 0; j < used.length; j += 1) flatWeights.push(i === j ? 0 : (Number.isFinite(weight(i, j)) ? weight(i, j) : -1));
    }
    const metaBase = {
        events: used.length,
        even,
        defects: flatDefects,
        weights: flatWeights,
        totalWeight: best ? best.total : -1,
        pairs: best ? best.pairs.flat() : [],
        matchingCount: matchings.length,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeNodes(used, []),
        edges: [],
        description: `Received ${used.length} detection event(s); the decoder pairs them by minimum total chain length.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { ...metaBase, phase: "syndrome" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(used, []),
        edges: makeEdges(candidates, "idle"),
        description: `${candidates.length} candidate pairs are within the distance limit and can share a correction chain.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { ...metaBase, phase: "graph" },
    };
    step += 1;

    const shown = matchings.slice(0, 6);
    for (const matching of shown) {
        yield {
            stepNumber: step,
            entities: makeNodes(used, matching.pairs),
            edges: makeEdges(matching.pairs, "comparing"),
            description: `Considering a pairing of total weight ${matching.total} across ${matching.pairs.length} chains.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { ...metaBase, phase: "search", candidateTotal: matching.total },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(used, best ? best.pairs : []),
        edges: makeEdges(best ? best.pairs : [], "sorted"),
        description: best
            ? `Optimal matching found with total weight ${best.total} over ${matchings.length} complete pairing(s).`
            : `No perfect matching exists within the distance limit.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { ...metaBase, phase: "done", totalWeight: best ? best.total : -1, pairs: best ? best.pairs.flat() : [] },
    };
}

/** The MWPM decoder module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Syndrome extraction tells you where errors were detected but not which physical error caused them. A minimum-weight perfect matching decoder pairs detection events and draws the shortest correction chain between each pair, choosing the pairing with the smallest total length. Shorter chains are more likely to match the real error, so the optimum is the best guess.",
        invariants: [
            "Every detection event appears in exactly one matched pair.",
            "Each allowed edge has an integer Manhattan length no larger than the distance limit.",
            "The chosen matching minimizes the sum of edge weights over all perfect matchings.",
        ],
        correctness:
            "The search enumerates every perfect matching by fixing the lowest-numbered unmatched event and trying each possible partner, then recursing on the rest. Because every matching has a unique first choice at each level, the enumeration is complete and disjoint. Taking the minimum total edge weight over that complete set therefore returns a true global minimum, and the returned pairs cover every event exactly once by construction.",
        complexityRationale:
            "The number of perfect matchings on m events is (m-1) double factorial, and each is generated in O(m) work, giving O((m-1)!!) time. The recursion stack and current pair list use O(m) space. Real decoders replace brute force with blossom algorithms that run in polynomial time.",
        uses: [
            "Decoding surface codes and other topological quantum codes",
            "Turning syndrome data into a concrete correction chain",
            "A teaching model for probabilistic error recovery",
        ],
        references: [
            "Fowler et al., Surface Codes: Towards Practical Large-Scale Quantum Computation, 2012",
            "Edmonds, Paths, Trees, and Flowers, 1965",
        ],
        workedExample:
            "Four detection events at grid points (0,0), (0,3), (4,1), and (4,4) have three perfect matchings. Pairing the two left points with the two right points costs 3 plus 3, totaling 6, which beats the diagonal pairings. The decoder returns those two short horizontal chains.",
    },
    id: "minimum-weight-perfect-matching-decoder",
    name: "Minimum-Weight Perfect Matching Decoder",
    category: "quantum",
    complexity: { time: "O((m-1)!!)", space: "O(m)" },
    defaultInput: {
        defects: [[0, 0], [0, 3], [4, 1], [4, 4]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "collect the detection events from the syndrome",
        "build a weighted graph with Manhattan edge lengths",
        "discard edges longer than the distance limit",
        "fix the smallest unmatched event",
        "try each partner and recurse on the remainder",
        "keep the matching with the smallest total weight",
        "done: report the matched pairs and chain length",
    ],
};

export default module;

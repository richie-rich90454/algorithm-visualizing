/**
 * douglas-peucker-polyline-simplification.ts – recursive polyline simplification.
 * Keep the farthest vertex when its distance exceeds epsilon, else drop all.
 * Time O(n log n) avg, Space O(n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function node(id: string, p: Pt, state: EntityState, label: string): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [p[0], p[1]],
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: {},
    };
}
function perpDist(p: Pt, a: Pt, b: Pt): number {
    const dx = b[0] - a[0],
        dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { polyline?: Pt[]; epsilon?: number } | null) ?? {};
    const line: Pt[] = t.polyline ?? [
        [0, 0],
        [1, 0.2],
        [2, 1.5],
        [3, 0.2],
        [4, 0],
    ];
    const eps: number = t.epsilon ?? 1.0;
    let step = 0;
    const base: VisualEntity[] = line.map((p, i) => node(`p-${i}`, p, "unvisited", String(i)));
    const fullEdges = line.slice(0, -1).map((_, i) => ({
        id: `e-${i}`,
        sourceId: `p-${i}`,
        targetId: `p-${i + 1}`,
        label: "",
        state: "idle" as EntityState,
        directed: false,
    }));
    const snap = (states: Map<number, EntityState>) =>
        base.map((e, i) => ({ ...e, state: states.get(i) ?? e.state }));

    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: fullEdges.map((e) => ({ ...e })),
        description: `Simplify ${line.length} vertices with ε=${eps}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { epsilon: eps },
    };
    if (line.length < 3) {
        yield {
            stepNumber: step++,
            entities: base.map((e) => ({ ...e, state: "sorted" as EntityState })),
            edges: fullEdges.map((e) => ({ ...e })),
            description: "Degenerate input: fewer than 3 vertices; nothing to simplify.",
            codeLineNumber: 1,
            layout: "point",
            meta: { kept: line.map((_, i) => i) },
        };
        return;
    }
    const keep = new Set<number>([0, line.length - 1]);
    const stack: Array<[number, number]> = [[0, line.length - 1]];
    yield {
        stepNumber: step++,
        entities: snap(
            new Map([
                [0, "comparing"],
                [line.length - 1, "comparing"],
            ]),
        ),
        edges: fullEdges.map((e) => ({ ...e })),
        description: `Anchor endpoints 0 and ${line.length - 1}.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { vertices: line.length },
    };
    while (stack.length > 0) {
        const [s, e] = stack.pop() as [number, number];
        let dmax = -1,
            idx = -1;
        for (let i = s + 1; i < e; i += 1) {
            const d = perpDist(line[i] as Pt, line[s] as Pt, line[e] as Pt);
            if (d > dmax) {
                dmax = d;
                idx = i;
            }
        }
        if (idx === -1) continue;
        const st = new Map<number, EntityState>([
            [s, "highlight"],
            [e, "highlight"],
            [idx, "comparing"],
        ]);
        yield {
            stepNumber: step++,
            entities: snap(st),
            edges: fullEdges.map((x) => ({ ...x })),
            description: `Span [${s},${e}]: farthest v${idx} at d=${dmax.toFixed(3)} ${dmax > eps ? "> ε: keep & split" : "≤ ε: drop interior"}.`,
            codeLineNumber: 4,
            layout: "point",
            meta: { span: [s, e], farthest: idx, dmax },
        };
        if (dmax > eps) {
            keep.add(idx);
            stack.push([s, idx], [idx, e]);
            if (step > 11) break;
        }
        if (step > 12) break;
    }
    const kept = [...keep].sort((a, b) => a - b);
    const st = new Map<number, EntityState>();
    kept.forEach((i) => st.set(i, "sorted"));
    const keptEdges = kept.slice(0, -1).map((v, k) => ({
        id: `k-${k}`,
        sourceId: `p-${v}`,
        targetId: `p-${kept[k + 1]}`,
        label: "",
        state: "sorted" as EntityState,
        directed: false,
    }));
    yield {
        stepNumber: step++,
        entities: snap(st),
        edges: keptEdges,
        description: `Simplified ${line.length} → ${kept.length} vertices [${kept.join(", ")}].`,
        codeLineNumber: 5,
        layout: "point",
        meta: { kept },
    };
}

const module: AlgorithmModule = {
    education: {
        "intuition": "Douglas-Peucker simplifies a polyline by keeping only the vertices that matter. It connects the endpoints of a segment, finds the interior vertex farthest from that line, and if the distance exceeds epsilon it keeps that vertex and recurses on the two halves. Vertices closer than epsilon are discarded.",
        "invariants": [
            "Every kept vertex is at distance greater than epsilon from the line connecting the current endpoints.",
            "The simplified polyline always starts and ends at the original endpoints.",
            "Discarded vertices lie within epsilon of some retained segment."
        ],
        "correctness": "If no interior vertex is farther than epsilon from the chord, replacing the whole chain by that chord adds at most epsilon error everywhere, so dropping them is safe. Otherwise the farthest vertex is a genuine corner and must be kept, and the same argument applies independently to the two subchains. Recursion therefore yields the minimal greedy set of vertices whose removal stays within epsilon along the whole line.",
        "complexityRationale": "Each recursion scans its subchain once to find the farthest vertex. In the common case of modest simplification the total is O(n log n); if nearly every vertex is kept the scan can degrade toward O(n^2). The recursion stack and point copies use O(n) space.",
        "uses": [
            "Simplifying GPS tracks for maps",
            "Reducing vertex counts in computer graphics meshes",
            "Compressing time series curves for display"
        ],
        "references": [
            "Douglas and Peucker, Algorithms for the Reduction of the Number of Points Required to Represent a Digitized Line, Canadian Cartographer 10 (1973)",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 2"
        ],
        "workedExample": "Polyline (0,0), (1,0.1), (2,0), (3,5) with epsilon = 1. From the chord (0,0)-(3,5), the point (2,0) is farthest at about 1.72, so it is kept. Its subchains drop (1,0.1) since that point is only 0.1 from (0,0)-(2,0). The result is (0,0), (2,0), (3,5)."
    },

    id: "douglas-peucker-polyline-simplification",
    name: "Douglas Peucker Simplification",
    category: "geometry",
    complexity: { time: "O(n log n) avg", space: "O(n)" },
    defaultInput: {
        polyline: [
            [0, 0],
            [1, 0.2],
            [2, 1.5],
            [3, 0.2],
            [4, 0],
        ],
        epsilon: 1.0,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start from the full polyline with tolerance eps",
        "anchor the first and last vertices as kept",
        "find the farthest interior vertex from the chord",
        "when it exceeds eps: keep it and split the span",
        "otherwise drop every interior vertex of the span",
        "done: kept vertices trace the simplified polyline",
    ],
};

export default module;

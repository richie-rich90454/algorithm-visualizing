/**
 * trapezoidal-map-point-location.ts – slab-based point location.
 * Vertical slabs through segment endpoints; within a slab order segments
 * by y at query x to find the face above/below. Time O(n log n), Space O(n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
type Seg = [Pt, Pt];

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
function yAt(s: Seg, x: number): number {
    const [[x1, y1], [x2, y2]] = s;
    if (x1 === x2) return (y1 + y2) / 2;
    return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { segments?: Seg[]; query?: Pt } | null) ?? {};
    const allSegs: Seg[] = (t.segments as Seg[] | undefined) ?? [
        [
            [0, 2],
            [4, 2],
        ],
    ];
    const query: Pt = t.query ?? [3, 3];
    let step = 0;
    const ents: VisualEntity[] = [];
    const edges = allSegs.map((s, i) => {
        ents.push(
            node(`p-s${i}a`, s[0], "unvisited", `s${i}a`),
            node(`p-s${i}b`, s[1], "unvisited", `s${i}b`),
        );
        return {
            id: `e-s${i}`,
            sourceId: `p-s${i}a`,
            targetId: `p-s${i}b`,
            label: "",
            state: "idle" as EntityState,
            directed: false,
        };
    });
    ents.push(node("p-q", query, "highlight", "q"));
    const snap = () => ents.map((e) => ({ ...e }));
    const snapE = () => edges.map((e) => ({ ...e }));

    yield {
        stepNumber: step++,
        entities: snap(),
        edges: snapE(),
        description: `Trapezoidal map of ${allSegs.length} segment(s); locate q=(${query[0]},${query[1]}).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { segments: allSegs.length, query },
    };
    if (allSegs.length === 0) {
        yield {
            stepNumber: step++,
            entities: snap(),
            edges: snapE(),
            description: "Degenerate input: no segments; query lies in the single unbounded face.",
            codeLineNumber: 1,
            layout: "point",
            meta: { face: "unbounded" },
        };
        return;
    }
    const xs = [...new Set(allSegs.flatMap((s) => [s[0][0], s[1][0]]))].sort((p, q2) => p - q2);
    yield {
        stepNumber: step++,
        entities: snap(),
        edges: snapE(),
        description: `Slab boundaries at x = [${xs.join(", ")}].`,
        codeLineNumber: 2,
        layout: "point",
        meta: { xs },
    };
    let slab = xs.length - 1;
    for (let i = 0; i < xs.length - 1; i += 1) {
        if (query[0] >= (xs[i] as number) && query[0] < (xs[i + 1] as number)) {
            slab = i;
            break;
        }
        if (query[0] === xs[xs.length - 1]) slab = xs.length - 1;
    }
    const lo = xs[Math.min(slab, xs.length - 1)],
        hi = xs[Math.min(slab + 1, xs.length - 1)];
    yield {
        stepNumber: step++,
        entities: snap(),
        edges: snapE(),
        description: `Query x=${query[0]} falls in slab [${lo}, ${hi}].`,
        codeLineNumber: 3,
        layout: "point",
        meta: { slab },
    };
    const spanning = allSegs
        .map((s, i) => ({ s, i, y: yAt(s, query[0]) }))
        .filter(
            ({ s }) =>
                query[0] >= Math.min(s[0][0], s[1][0]) && query[0] <= Math.max(s[0][0], s[1][0]),
        )
        .sort((p, q2) => p.y - q2.y);
    yield {
        stepNumber: step++,
        entities: snap(),
        edges: snapE(),
        description: `${spanning.length} segment(s) span the slab; sorted by y at x=${query[0]}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { count: spanning.length },
    };
    let below = -1;
    for (let k = 0; k < spanning.length; k += 1) {
        if ((spanning[k] as { y: number }).y <= query[1]) below = k;
    }
    const aboveSeg = spanning[below + 1];
    if (aboveSeg) {
        const e = edges[aboveSeg.i as number];
        if (e) e.state = "comparing";
    }
    yield {
        stepNumber: step++,
        entities: snap(),
        edges: snapE(),
        description: aboveSeg
            ? `Face between y=${(spanning[below] as { y: number } | undefined)?.y ?? "-∞"} and segment s${aboveSeg.i} (y=${aboveSeg.y.toFixed(2)}).`
            : `Query above all ${spanning.length} segment(s): unbounded top face.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { below, above: aboveSeg?.i ?? null },
    };
    for (const e of edges) e.state = "sorted";
    for (const n of ents) if (n.id === "p-q") n.state = "sorted";
    yield {
        stepNumber: step++,
        entities: snap(),
        edges: snapE(),
        description: `Located: q is ${aboveSeg ? `below segment s${aboveSeg.i}` : "in the top unbounded face"}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { face: aboveSeg ? `below-s${aboveSeg.i}` : "top-unbounded" },
    };
}

const module: AlgorithmModule = {
    education: {
        "intuition": "A trapezoidal map breaks the plane into vertical slabs at segment endpoints. Inside a slab the segments do not change order, so a query point's cell can be found by locating its slab and then finding which adjacent segments lie above and below it at the query x.",
        "invariants": [
            "Within one slab the vertical order of segments is fixed.",
            "Every cell in a slab is bounded above and below by consecutive segments in that order.",
            "The query x lies between the slab's two endpoint boundaries."
        ],
        "correctness": "Segment endpoints are the only x values where the set or order of crossing segments changes, so a slab's decomposition is constant. Evaluating each segment's y at the query x and sorting them gives the faces stacked vertically, and locating the point between two consecutive segments identifies its trapezoid. Since slabs partition the domain and every face is captured this way, the point location is exact.",
        "complexityRationale": "Sorting slabs and, within a slab, sorting segments by y costs O(n log n) preprocessing. A query evaluates O(n) segments in this simple demo, with O(n) space for slabs and segments.",
        "uses": [
            "Planar point location in geographic information systems",
            "Face finding for polygon meshes",
            "Hit testing against sets of non-crossing segments"
        ],
        "references": [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 6",
            "Preparata and Shamos, Computational Geometry: An Introduction, Chapter 7"
        ],
        "workedExample": "Segments y = 0 and y = 2 both span x from 0 to 4, giving one slab. A query at (2,1) finds the segments ordered at heights 0 and 2 and is located between them; a query at (2,3) is located above both."
    },

    id: "trapezoidal-map-point-location",
    name: "Trapezoidal Map Point Location",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        segments: [
            [
                [0, 2],
                [4, 2],
            ],
        ],
        query: [3, 3],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start from segments plus query point q",
        "collect every segment endpoint as slab walls",
        "find the vertical slab holding q",
        "gather segments spanning that slab",
        "sort spanning segments by height at q",
        "walk the order to find the face of q",
        "done: the reported face locates q in the map",
    ],
};

export default module;

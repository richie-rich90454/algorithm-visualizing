/**
 * pick-theorem-lattice-points.ts – Pick's theorem lattice count.
 * For a lattice polygon: boundary B=Σgcd(|dx|,|dy|), area A via shoelace,
 * interior I=A−B/2+1. O(n) time, O(1) space. Exact integer result.
 * Layout "point": lattice vertices carry true coords; boundary edges shown.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b > 0) {
        const t = a % b;
        a = b;
        b = t;
    }
    return a;
}

function nodes(pts: Pt[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return pts.map(([x, y], i) => ({
        id: `p-${i}`,
        type: "node" as const,
        label: `v${i}(${x},${y})`,
        value: [x, y],
        state: states.get(i) ?? "unvisited",
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const pts: Pt[] = task.points ?? [
        [0, 0],
        [4, 0],
        [0, 3],
    ];
    let step = 0;
    if (pts.length < 3) {
        yield {
            stepNumber: step,
            entities: nodes(pts),
            edges: [],
            description: "Fewer than 3 lattice points – no polygon.",
            codeLineNumber: 0,
            layout: "point",
            meta: { boundary: 0, area: 0, interior: 0 },
        };
        return;
    }
    const edges: VisualEdge[] = pts.map((_, i) => ({
        id: `b-${i}`,
        sourceId: `p-${i}`,
        targetId: `p-${(i + 1) % pts.length}`,
        label: "",
        state: "idle",
        directed: false,
    }));
    yield {
        stepNumber: step,
        entities: nodes(pts),
        edges,
        description: `Pick's theorem on a lattice ${pts.length}-gon.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { vertices: pts.length },
    };
    step += 1;
    let b = 0;
    let cross2 = 0;
    for (let i = 0; i < pts.length; i += 1) {
        const p = pts[i] as Pt;
        const q = pts[(i + 1) % pts.length] as Pt;
        const g = gcd(q[0] - p[0], q[1] - p[1]);
        b += g;
        cross2 += p[0] * q[1] - q[0] * p[1];
        yield {
            stepNumber: step,
            entities: nodes(
                pts,
                new Map([
                    [i, "active"],
                    [(i + 1) % pts.length, "comparing"],
                ]),
            ),
            edges,
            description: `Edge ${i}→${(i + 1) % pts.length}: gcd=${g}, running B=${b}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { edge: i, boundary: b },
        };
        step += 1;
    }
    const area = Math.abs(cross2) / 2;
    yield {
        stepNumber: step,
        entities: nodes(pts, new Map(pts.map((_, i) => [i, "sorted"] as [number, EntityState]))),
        edges,
        description: `Shoelace area A=${area}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { area },
    };
    step += 1;
    const interior = area - b / 2 + 1;
    yield {
        stepNumber: step,
        entities: nodes(pts, new Map(pts.map((_, i) => [i, "sorted"] as [number, EntityState]))),
        edges,
        description: `I = A − B/2 + 1 = ${area} − ${b}/2 + 1 = ${interior}. Total lattice points = ${interior + b}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { boundary: b, area, interior },
    };
}

const module: AlgorithmModule = {
    education: {
        "intuition": "Pick's theorem gives a striking formula for a polygon whose vertices are integer grid points: the area equals the number of interior lattice points plus half the boundary lattice points minus one. The demo counts boundary points by summing gcds along edges, gets the area from the shoelace formula, and solves for the interior count.",
        "invariants": [
            "An edge from (x1,y1) to (x2,y2) contains gcd(|dx|,|dy|) + 1 lattice points including endpoints.",
            "The total boundary count B sums the gcd contributions without double counting corners.",
            "The interior count I = A - B/2 + 1 is a nonnegative integer for a lattice polygon."
        ],
        "correctness": "The shoelace formula gives the exact polygon area A for lattice vertices. Walking the boundary, the number of lattice steps along an edge is gcd(|dx|,|dy|), and summing these over edges counts each boundary point once because endpoints are shared between adjacent edges. Pick's theorem states A = I + B/2 - 1 for any simple lattice polygon, so rearranging yields I = A - B/2 + 1.",
        "complexityRationale": "Each edge requires one gcd and one shoelace term, so both time and auxiliary space are O(1) per edge and O(n) overall for the vertex list.",
        "uses": [
            "Counting lattice points inside polygon-shaped regions",
            "Checking results of lattice enumeration algorithms",
            "Problems in discrete geometry and number theory"
        ],
        "references": [
            "Pick, Geometrisches zum Viereck, Sitzungsberichte Naturwissenschaftlicher Verein (1899)",
            "O'Rourke, Computational Geometry in C, Section 2.2"
        ],
        "workedExample": "For the lattice triangle (0,0), (4,0), (0,3), shoelace area A = 6. Boundary gcds are 4, 3, and 1, so B = 8. Pick's theorem gives I = 6 - 4 + 1 = 3 interior lattice points."
    },

    id: "pick-theorem-lattice-points",
    name: "Pick's Theorem (Lattice Points)",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: {
        points: [
            [0, 0],
            [4, 0],
            [0, 3],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start from lattice polygon vertices",
        "sum gcd of edge steps for boundary points B",
        "run the shoelace sum for doubled area 2A",
        "halve it for the polygon area A",
        "solve interior points as A minus B over 2 plus 1",
        "done: interior plus boundary counts every lattice point",
    ],
};

export default module;

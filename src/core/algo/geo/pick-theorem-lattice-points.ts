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
        codeLineNumber: 0,
        layout: "point",
        meta: {},
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
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    const area = Math.abs(cross2) / 2;
    yield {
        stepNumber: step,
        entities: nodes(pts, new Map(pts.map((_, i) => [i, "sorted"] as [number, EntityState]))),
        edges,
        description: `Shoelace area A=${area}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: {},
    };
    step += 1;
    const interior = area - b / 2 + 1;
    yield {
        stepNumber: step,
        entities: nodes(pts, new Map(pts.map((_, i) => [i, "sorted"] as [number, EntityState]))),
        edges,
        description: `I = A − B/2 + 1 = ${area} − ${b}/2 + 1 = ${interior}. Total lattice points = ${interior + b}.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { boundary: b, area, interior },
    };
}

const module: AlgorithmModule = {
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
};

export default module;

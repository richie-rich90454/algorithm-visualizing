/**
 * polygon-triangulation-ear-clipping.ts – Ear clipping triangulation.
 * Repeatedly finds an "ear" (convex vertex whose triangle holds no other
 * vertex) and clips it until one triangle remains. O(n^2) time, O(n) space.
 * Layout "point": vertices carry true coords; diagonals are frame edges.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

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

function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function inTri(p: Pt, a: Pt, b: Pt, c: Pt): boolean {
    const d1 = cross(p, a, b);
    const d2 = cross(p, b, c);
    const d3 = cross(p, c, a);
    return (d1 > 1e-9 && d2 > 1e-9 && d3 > 1e-9) || (d1 < -1e-9 && d2 < -1e-9 && d3 < -1e-9);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const pts: Pt[] = task.points ?? [
        [0, 0],
        [4, 0],
        [4, 3],
        [2, 2],
        [0, 3],
    ];
    let step = 0;
    if (pts.length < 3) {
        yield {
            stepNumber: step,
            entities: nodes(pts),
            edges: [],
            description: "Fewer than 3 vertices – no polygon to triangulate.",
            codeLineNumber: 0,
            layout: "point",
            meta: { triangles: [] },
        };
        return;
    }
    const boundary = (extra: VisualEdge[] = []): VisualEdge[] => {
        const e: VisualEdge[] = pts.map((_, i) => ({
            id: `b-${i}`,
            sourceId: `p-${i}`,
            targetId: `p-${(i + 1) % pts.length}`,
            label: "",
            state: "idle",
            directed: false,
        }));
        return [...e, ...extra];
    };
    yield {
        stepNumber: step,
        entities: nodes(pts),
        edges: boundary(),
        description: `Ear clipping on a ${pts.length}-gon – scanning for ears.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    const alive = pts.map((_, i) => i);
    const diag: VisualEdge[] = [];
    const found: Array<[number, number, number]> = [];
    let guard = 0;
    while (alive.length > 3 && guard < 100) {
        guard += 1;
        let clipped = false;
        for (let k = 0; k < alive.length; k += 1) {
            const prev = alive[(k - 1 + alive.length) % alive.length] as number;
            const cur = alive[k] as number;
            const next = alive[(k + 1) % alive.length] as number;
            const a = pts[prev] as Pt;
            const b = pts[cur] as Pt;
            const c = pts[next] as Pt;
            if (cross(a, b, c) <= 1e-9) continue;
            const clean = alive.every(
                (m) => m === prev || m === cur || m === next || !inTri(pts[m] as Pt, a, b, c),
            );
            if (!clean) continue;
            found.push([prev, cur, next]);
            alive.splice(k, 1);
            diag.push({
                id: `d-${prev}-${next}`,
                sourceId: `p-${prev}`,
                targetId: `p-${next}`,
                label: "",
                state: "path",
                directed: false,
            });
            yield {
                stepNumber: step,
                entities: nodes(
                    pts,
                    new Map([
                        [cur, "swapped"],
                        [prev, "sorted"],
                        [next, "sorted"],
                    ]),
                ),
                edges: boundary([...diag]),
                description: `Clipped ear (${prev}, ${cur}, ${next}) – diagonal ${prev}–${next} added.`,
                codeLineNumber: 1,
                layout: "point",
                meta: {},
            };
            step += 1;
            clipped = true;
            break;
        }
        if (!clipped) break;
    }
    found.push([alive[0] as number, alive[1] as number, alive[2] as number]);
    const all = new Map<number, EntityState>(pts.map((_, i) => [i, "sorted"]));
    yield {
        stepNumber: step,
        entities: nodes(pts, all),
        edges: boundary([...diag]),
        description: `Triangulation complete: ${found.length} triangles.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { triangles: found.map((t) => t.join(",")) },
    };
}

const module: AlgorithmModule = {
    id: "polygon-triangulation-ear-clipping",
    name: "Polygon Triangulation (Ear Clipping)",
    category: "geometry",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [4, 0],
            [4, 3],
            [2, 2],
            [0, 3],
        ],
    },
    visualType: "graph",
    run,
};

export default module;

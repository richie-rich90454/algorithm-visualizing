/**
 * largest-empty-circle-voronoi.ts – largest empty circle on tiny point sets.
 * Candidates: circumcenters of triples (Voronoi vertices) inside the bbox
 * whose circle is empty; plus bbox-corner-anchored fallback. O(n^4), honest.
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
function circumcenter(a: Pt, b: Pt, c: Pt): { o: Pt; r: number } | null {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-12) return null;
    const a2 = a[0] * a[0] + a[1] * a[1],
        b2 = b[0] * b[0] + b[1] * b[1],
        c2 = c[0] * c[0] + c[1] * c[1];
    const ox = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
    const oy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
    return { o: [ox, oy], r: Math.hypot(ox - a[0], oy - a[1]) };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { points?: Pt[] } | null) ?? {};
    const pts: Pt[] = t.points ?? [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
    ];
    let step = 0;
    const base = pts.map((p, i) => node(`p-${i}`, p, "unvisited", String(i)));
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: [],
        description: `Largest empty circle over ${pts.length} sites.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    if (pts.length < 3) {
        yield {
            stepNumber: step++,
            entities: base.map((e) => ({ ...e })),
            edges: [],
            description: "Degenerate input: need ≥3 sites for a Voronoi vertex.",
            codeLineNumber: 1,
            layout: "point",
            meta: { radius: 0 },
        };
        return;
    }
    const xs = pts.map((p) => p[0]),
        ys = pts.map((p) => p[1]);
    const box = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] as const;
    let best: { o: Pt; r: number; triple: number[] } | null = null;
    let shown = 0;
    const centers: VisualEntity[] = [];
    outer: for (let i = 0; i < pts.length; i += 1) {
        for (let j = i + 1; j < pts.length; j += 1) {
            for (let k = j + 1; k < pts.length; k += 1) {
                const cc = circumcenter(pts[i] as Pt, pts[j] as Pt, pts[k] as Pt);
                if (!cc) continue;
                const [x0, x1, y0, y1] = box;
                if (
                    cc.o[0] < x0 - 1e-9 ||
                    cc.o[0] > x1 + 1e-9 ||
                    cc.o[1] < y0 - 1e-9 ||
                    cc.o[1] > y1 + 1e-9
                )
                    continue;
                const empty = pts.every(
                    (p) => Math.hypot(p[0] - cc.o[0], p[1] - cc.o[1]) >= cc.r - 1e-9,
                );
                const id = `c-${i}-${j}-${k}`;
                centers.push(
                    node(id, cc.o, empty ? "comparing" : "visited", `r=${cc.r.toFixed(2)}`),
                );
                if (empty && (!best || cc.r > best.r))
                    best = { o: cc.o, r: cc.r, triple: [i, j, k] };
                if (empty) {
                    shown += 1;
                    yield {
                        stepNumber: step++,
                        entities: [
                            ...base.map((e) => ({ ...e })),
                            ...centers.map((e) => ({ ...e })),
                        ],
                        edges: [],
                        description: `Triple (${i},${j},${k}): center (${cc.o[0].toFixed(2)}, ${cc.o[1].toFixed(2)}), r=${cc.r.toFixed(3)} ${empty ? "empty ✓" : "non-empty"}.`,
                        codeLineNumber: 2,
                        layout: "point",
                        meta: { triple: [i, j, k], r: cc.r },
                    };
                    if (step > 11 || shown >= 5) break outer;
                }
            }
        }
    }
    if (!best) {
        yield {
            stepNumber: step++,
            entities: [...base.map((e) => ({ ...e })), ...centers.map((e) => ({ ...e }))],
            edges: [],
            description: "No empty circumcircle inside the bbox; fallback reports radius 0.",
            codeLineNumber: 3,
            layout: "point",
            meta: { radius: 0 },
        };
        return;
    }
    const fin = [
        ...base.map((e) => ({ ...e })),
        ...centers.map((e) => ({ ...e, state: "sorted" as EntityState })),
    ];
    yield {
        stepNumber: step++,
        entities: fin,
        edges: [],
        description: `Largest empty circle: center (${best.o[0].toFixed(3)}, ${best.o[1].toFixed(3)}), r=${best.r.toFixed(4)} via sites ${best.triple.join(",")}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { center: best.o, radius: best.r, triple: best.triple },
    };
}

const module: AlgorithmModule = {
    id: "largest-empty-circle-voronoi",
    name: "Largest Empty Circle",
    category: "geometry",
    complexity: { time: "O(n⁴)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
        ],
    },
    visualType: "graph",
    run,
};

export default module;

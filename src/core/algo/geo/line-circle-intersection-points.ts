/**
 * line-circle-intersection-points.ts – Line–circle intersection.
 * Projects the center onto the line (closest point m at parameter t*),
 * then steps ±h along the unit direction with h²=r²−|m−c|². O(1).
 * Layout "point": line endpoints a/b, center, closest m, hits, true coords.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function ptNode(id: string, [x, y]: Pt, label: string, state: EntityState): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [x, y],
        state,
        x,
        y,
        width: 0,
        height: 0,
        metadata: {},
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { line?: [Pt, Pt]; center?: Pt; r?: number } | null) ?? {};
    const a: Pt = task.line?.[0] ?? [0, 0];
    const b: Pt = task.line?.[1] ?? [4, 2];
    const c: Pt = task.center ?? [2, 1];
    const r = task.r ?? 2;
    let step = 0;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const seg: VisualEdge[] = [
        { id: "line", sourceId: "a", targetId: "b", label: "", state: "idle", directed: false },
    ];
    if (len2 < 1e-12) {
        yield {
            stepNumber: step,
            entities: [ptNode("a", a, "A", "active")],
            edges: [],
            description: "Degenerate line (a=b) – no direction.",
            codeLineNumber: 0,
            layout: "point",
            meta: { points: [] },
        };
        return;
    }
    const base = (): VisualEntity[] => [
        ptNode("a", a, `A(${a})`, "active"),
        ptNode("b", b, `B(${b})`, "active"),
        ptNode("c", c, `C(${c}) r=${r}`, "comparing"),
    ];
    yield {
        stepNumber: step,
        entities: base(),
        edges: seg,
        description: `Line AB vs circle (C, r=${r}).`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    const t = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / len2;
    const m: Pt = [a[0] + t * dx, a[1] + t * dy];
    yield {
        stepNumber: step,
        entities: [
            ...base(),
            ptNode("m", m, `M(${m.map((v) => Math.round(v * 100) / 100)})`, "highlight"),
        ],
        edges: seg,
        description: `Closest point M at t=${t.toFixed(2)}.`,
        codeLineNumber: 1,
        layout: "point",
        meta: {},
    };
    step += 1;
    const dist = Math.hypot(m[0] - c[0], m[1] - c[1]);
    yield {
        stepNumber: step,
        entities: [...base(), ptNode("m", m, "M", "highlight")],
        edges: seg,
        description: `|M−C|=${dist.toFixed(2)} vs r=${r}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: {},
    };
    step += 1;
    if (dist > r + 1e-9) {
        yield {
            stepNumber: step,
            entities: [...base(), ptNode("m", m, "M", "highlight")],
            edges: seg,
            description: "Line misses the circle – no intersection.",
            codeLineNumber: 3,
            layout: "point",
            meta: { points: [] },
        };
        return;
    }
    const h = Math.sqrt(Math.max(0, r * r - dist * dist));
    const len = Math.sqrt(len2);
    const ux = dx / len;
    const uy = dy / len;
    const p: Pt = [
        Math.round((m[0] + h * ux) * 100) / 100,
        Math.round((m[1] + h * uy) * 100) / 100,
    ];
    const q: Pt = [
        Math.round((m[0] - h * ux) * 100) / 100,
        Math.round((m[1] - h * uy) * 100) / 100,
    ];
    const pts = h < 1e-9 ? [p] : [p, q];
    yield {
        stepNumber: step,
        entities: [
            ...base(),
            ptNode("m", m, "M", "highlight"),
            ...pts.map((s, i) => ptNode(`x-${i}`, s, `X${i}(${s})`, "sorted")),
        ],
        edges: seg,
        description: h < 1e-9 ? `Tangent at (${p}).` : `h=${h.toFixed(2)}: hits (${p}) and (${q}).`,
        codeLineNumber: 3,
        layout: "point",
        meta: { points: pts.map(([x, y]) => `${x},${y}`) },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [...base(), ...pts.map((s, i) => ptNode(`x-${i}`, s, `X${i}(${s})`, "sorted"))],
        edges: seg,
        description: `Verified: |X0−C|=${Math.hypot(pts[0][0] - c[0], pts[0][1] - c[1]).toFixed(2)} (r=${r}).`,
        codeLineNumber: 4,
        layout: "point",
        meta: { points: pts.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    id: "line-circle-intersection-points",
    name: "Line–Circle Intersection",
    category: "geometry",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: {
        line: [
            [0, 0],
            [4, 2],
        ],
        center: [2, 1],
        r: 2,
    },
    visualType: "graph",
    run,
};

export default module;

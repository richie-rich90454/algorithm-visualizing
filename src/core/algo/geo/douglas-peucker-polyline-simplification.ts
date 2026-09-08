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
        codeLineNumber: 1,
        layout: "point",
        meta: {},
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
            codeLineNumber: 2,
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
        codeLineNumber: 3,
        layout: "point",
        meta: { kept },
    };
}

const module: AlgorithmModule = {
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
};

export default module;

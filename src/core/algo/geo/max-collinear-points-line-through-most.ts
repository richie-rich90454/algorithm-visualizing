/**
 * max-collinear-points-line-through-most.ts – line through the most points.
 * Slope-hash per anchor with gcd-normalized (dx,dy); duplicates counted.
 * Time O(n²), Space O(n).
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
function gcd(a: number, b: number): number {
    return b === 0 ? Math.abs(a) : gcd(b, a % b);
}
function bestLine(pts: Pt[]): { count: number; members: number[] } {
    let best = { count: Math.min(1, pts.length), members: pts.length > 0 ? [0] : [] };
    for (let i = 0; i < pts.length; i += 1) {
        const slopes = new Map<string, number[]>();
        let dup = 0;
        for (let j = i + 1; j < pts.length; j += 1) {
            let dx = (pts[j] as Pt)[0] - (pts[i] as Pt)[0],
                dy = (pts[j] as Pt)[1] - (pts[i] as Pt)[1];
            if (dx === 0 && dy === 0) {
                dup += 1;
                continue;
            }
            const g = gcd(dx, dy);
            dx /= g;
            dy /= g;
            if (dx < 0 || (dx === 0 && dy < 0)) {
                dx = -dx;
                dy = -dy;
            }
            const key = `${dx},${dy}`;
            const arr = slopes.get(key) ?? [];
            arr.push(j);
            slopes.set(key, arr);
        }
        for (const members of slopes.values()) {
            const total = members.length + 1 + dup;
            if (total > best.count) best = { count: total, members: [i, ...members] };
        }
        if (slopes.size === 0 && dup + 1 > best.count) best = { count: dup + 1, members: [i] };
    }
    return best;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { points?: Pt[] } | null) ?? {};
    const pts: Pt[] = t.points ?? [
        [0, 0],
        [1, 1],
        [2, 2],
        [0, 2],
        [2, 0],
        [3, 3],
    ];
    let step = 0;
    const base = pts.map((p, i) => node(`p-${i}`, p, "unvisited", String(i)));
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: [],
        description: `Max collinear subset of ${pts.length} points by slope hashing.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    if (pts.length < 2) {
        yield {
            stepNumber: step++,
            entities: base.map((e) => ({ ...e, state: "sorted" as EntityState })),
            edges: [],
            description: "Degenerate input: fewer than 2 points.",
            codeLineNumber: 1,
            layout: "point",
            meta: { count: pts.length },
        };
        return;
    }
    const anchors = [...new Set([0, 1, 2])].filter((a) => a < pts.length);
    for (const a of anchors) {
        const slopes = new Map<string, number>();
        for (let j = 0; j < pts.length; j += 1) {
            if (j === a) continue;
            let dx = (pts[j] as Pt)[0] - (pts[a] as Pt)[0],
                dy = (pts[j] as Pt)[1] - (pts[a] as Pt)[1];
            if (dx === 0 && dy === 0) continue;
            const g = gcd(dx, dy);
            dx /= g;
            dy /= g;
            if (dx < 0 || (dx === 0 && dy < 0)) {
                dx = -dx;
                dy = -dy;
            }
            slopes.set(`${dx},${dy}`, (slopes.get(`${dx},${dy}`) ?? 0) + 1);
        }
        let top = 0;
        for (const v of slopes.values()) top = Math.max(top, v);
        yield {
            stepNumber: step++,
            entities: base.map((e, k) => ({
                ...e,
                state: k === a ? ("comparing" as EntityState) : e.state,
            })),
            edges: [],
            description: `Anchor ${a}: best slope group = ${top} (+1 anchor = ${top + 1}).`,
            codeLineNumber: 2,
            layout: "point",
            meta: { anchor: a, best: top + 1 },
        };
    }
    const best = bestLine(pts);
    const st = new Set(best.members);
    const lineEdges = best.members.slice(0, -1).map((v, k) => ({
        id: `m-${k}`,
        sourceId: `p-${v}`,
        targetId: `p-${best.members[k + 1]}`,
        label: "",
        state: "sorted" as EntityState,
        directed: false,
    }));
    yield {
        stepNumber: step++,
        entities: base.map((e, k) => ({
            ...e,
            state: st.has(k) ? ("comparing" as EntityState) : e.state,
        })),
        edges: lineEdges.map((e) => ({ ...e })),
        description: `Best line holds ${best.count} points: [${best.members.join(", ")}].`,
        codeLineNumber: 3,
        layout: "point",
        meta: { count: best.count },
    };
    yield {
        stepNumber: step++,
        entities: base.map((e, k) => ({
            ...e,
            state: st.has(k) ? ("sorted" as EntityState) : e.state,
        })),
        edges: lineEdges.map((e) => ({ ...e })),
        description: `Max collinear count = ${best.count}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { count: best.count, members: best.members },
    };
}

const module: AlgorithmModule = {
    id: "max-collinear-points-line-through-most",
    name: "Max Collinear Points",
    category: "geometry",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [1, 1],
            [2, 2],
            [0, 2],
            [2, 0],
            [3, 3],
        ],
    },
    visualType: "graph",
    run,
};

export default module;

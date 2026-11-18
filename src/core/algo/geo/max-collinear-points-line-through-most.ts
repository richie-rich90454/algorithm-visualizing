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
        meta: { points: pts.length },
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
            codeLineNumber: 3,
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
        codeLineNumber: 4,
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
        codeLineNumber: 5,
        layout: "point",
        meta: { count: best.count, members: best.members },
    };
}

const module: AlgorithmModule = {
    education: {
        "intuition": "To find the line passing through the most points, treat each point in turn as an anchor and compute the direction to every other point. Normalizing each direction by the greatest common divisor of its components makes points on the same line share a key, so counting equal keys finds the best line through that anchor.",
        "invariants": [
            "The normalized direction pair (dx/g, dy/g) is identical for all points on one line through the anchor.",
            "Duplicate points at the anchor are counted separately.",
            "The best count for an anchor includes the anchor itself."
        ],
        "correctness": "Two points lie on the same line through the anchor exactly when their displacement vectors are positive scalar multiples, which is equivalent to having the same reduced direction after dividing by the gcd and fixing the sign. Grouping by that key therefore collects precisely the collinear points, and taking the maximum group over all anchors covers every possible line because any line contains at least one of its points as an anchor.",
        "complexityRationale": "For each of n anchors the algorithm computes and hashes n-1 directions, costing O(n^2) time with gcd operations. Hash maps for one anchor at a time use O(n) space.",
        "uses": [
            "Detecting aligned features in image analysis",
            "Finding recurring slopes in scattered data",
            "Solving the classic maximum-points-on-a-line problem"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 11 (hash tables)",
            "Competitive Programming 3, Hall and Li, geometry chapter"
        ],
        "workedExample": "For points (0,0), (1,1), (2,2), (1,0), (2,0), (2,1), anchoring at (0,0) gives reduced directions (1,1) twice and (1,0) twice. Including the anchor, the line y = x contains three points, which is the maximum."
    },

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
    pseudocode: [
        "start from the full point set",
        "anchor each point and hash slopes to the rest",
        "count duplicates plus the best slope group",
        "track the anchor with the largest group",
        "collect every member of the winning line",
        "done: the biggest collinear subset and its count",
    ],
};

export default module;

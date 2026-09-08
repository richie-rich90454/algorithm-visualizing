/**
 * poisson-disk-sampling.ts – Bridson's blue-noise sampling with a fixed LCG.
 * Deterministic: seed 123456789, k=8 candidates per active point on a grid
 * of cell r/√2. Time O(n), Space O(n).
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
function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}
function sample(width: number, height: number, r: number, seed: number): Pt[] {
    const rand = lcg(seed);
    const cell = r / Math.SQRT2;
    const gw = Math.ceil(width / cell),
        gh = Math.ceil(height / cell);
    const grid: number[] = new Array(gw * gh).fill(-1);
    const pts: Pt[] = [];
    const put = (p: Pt): number => {
        const i = pts.length;
        pts.push(p);
        grid[Math.floor(p[1] / cell) * gw + Math.floor(p[0] / cell)] = i;
        return i;
    };
    put([width * (0.2 + 0.6 * (rand() as number)), height * (0.2 + 0.6 * (rand() as number))]);
    const active = [0];
    const ok = (p: Pt): boolean => {
        if (p[0] < 0 || p[0] >= width || p[1] < 0 || p[1] >= height) return false;
        const cx = Math.floor(p[0] / cell),
            cy = Math.floor(p[1] / cell);
        for (let y = Math.max(0, cy - 2); y <= Math.min(gh - 1, cy + 2); y += 1)
            for (let x = Math.max(0, cx - 2); x <= Math.min(gw - 1, cx + 2); x += 1) {
                const gi = grid[y * gw + x] as number;
                if (gi >= 0 && Math.hypot((pts[gi] as Pt)[0] - p[0], (pts[gi] as Pt)[1] - p[1]) < r)
                    return false;
            }
        return true;
    };
    while (active.length > 0) {
        const ai = Math.floor((rand() as number) * active.length);
        const src = pts[active[ai] as number] as Pt;
        let placed = false;
        for (let k = 0; k < 8; k += 1) {
            const ang = (rand() as number) * 2 * Math.PI;
            const rad = r * (1 + (rand() as number));
            if (ok([src[0] + rad * Math.cos(ang), src[1] + rad * Math.sin(ang)])) {
                active.push(put([src[0] + rad * Math.cos(ang), src[1] + rad * Math.sin(ang)]));
                placed = true;
                break;
            }
        }
        if (!placed) active.splice(ai, 1);
    }
    return pts;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { width?: number; height?: number; radius?: number } | null) ?? {};
    const W = t.width ?? 4,
        H = t.height ?? 4,
        R = t.radius ?? 1.2;
    let step = 0;
    if (W <= 0 || H <= 0 || R <= 0) {
        yield {
            stepNumber: step++,
            entities: [],
            edges: [],
            description: "Degenerate input: positive width, height and radius required.",
            codeLineNumber: 1,
            layout: "point",
            meta: { count: 0 },
        };
        return;
    }
    const pts = sample(W, H, R, 123456789);
    const groups = Math.min(6, pts.length);
    const per = Math.max(1, Math.floor(pts.length / Math.max(1, groups)));
    for (let g = 0; g < groups; g += 1) {
        const shown = pts.slice(0, g === groups - 1 ? pts.length : (g + 1) * per);
        yield {
            stepNumber: step++,
            entities: shown.map((p, i) =>
                node(
                    `p-${i}`,
                    p,
                    i < g * per ? ("visited" as EntityState) : ("comparing" as EntityState),
                    String(i),
                ),
            ),
            edges: [],
            description: `Accepted ${shown.length}/${pts.length} samples; active-front expansion.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { accepted: shown.length },
        };
    }
    yield {
        stepNumber: step++,
        entities: pts.map((p, i) => node(`p-${i}`, p, "sorted", String(i))),
        edges: [],
        description: `Done: ${pts.length} blue-noise samples, min distance ≥ ${R}.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { count: pts.length, radius: R },
    };
}

const module: AlgorithmModule = {
    id: "poisson-disk-sampling",
    name: "Poisson Disk Sampling",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { width: 4, height: 4, radius: 1.2 },
    visualType: "point",
    run,
};

export default module;

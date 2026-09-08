/**
 * circle-union-area-sweep.ts – exact union area of circles.
 * Angular sweep per circle: cut boundary at pairwise intersections, keep
 * uncovered arcs, sum Green's-theorem contributions. O(n² log n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Circle = [number, number, number];

function node(id: string, x: number, y: number, state: EntityState, label: string): VisualEntity {
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
function unionArea(circles: Circle[]): { area: number; per: number[] } {
    const per: number[] = [];
    let area = 0;
    for (let i = 0; i < circles.length; i += 1) {
        const [cx, cy, r] = circles[i] as Circle;
        const angs: number[] = [];
        let contained = false;
        for (let j = 0; j < circles.length; j += 1) {
            if (i === j) continue;
            const [ox, oy, orr] = circles[j] as Circle;
            const d = Math.hypot(ox - cx, oy - cy);
            if (d + r <= orr + 1e-12) {
                contained = true;
                break;
            }
            if (d >= r + orr - 1e-12 || d <= Math.abs(r - orr) + 1e-12 || d < 1e-12) continue;
            const base = Math.atan2(oy - cy, ox - cx);
            const c = (r * r + d * d - orr * orr) / (2 * r * d);
            const off = Math.acos(Math.min(1, Math.max(-1, c)));
            angs.push(base - off, base + off);
        }
        if (contained) {
            per.push(0);
            continue;
        }
        if (angs.length === 0) {
            per.push(Math.PI * r * r);
            area += Math.PI * r * r;
            continue;
        }
        const norm = angs
            .map((a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))
            .sort((a, b) => a - b);
        let contrib = 0;
        for (let k = 0; k < norm.length; k += 1) {
            const t1 = norm[k] as number,
                t2 = (
                    k + 1 < norm.length ? norm[k + 1] : (norm[0] as number) + 2 * Math.PI
                ) as number;
            const mid = (t1 + t2) / 2;
            const mx = cx + r * Math.cos(mid),
                my = cy + r * Math.sin(mid);
            const covered = circles.some(
                (cc, j) => j !== i && Math.hypot(mx - cc[0], my - cc[1]) < (cc[2] as number) - 1e-9,
            );
            if (!covered)
                contrib +=
                    0.5 *
                    (cx * r * (Math.sin(t2) - Math.sin(t1)) -
                        cy * r * (Math.cos(t2) - Math.cos(t1)) +
                        r * r * (t2 - t1));
        }
        per.push(contrib);
        area += contrib;
    }
    return { area, per };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { circles?: Circle[] } | null) ?? {};
    const circles: Circle[] = t.circles ?? [
        [0, 0, 1],
        [1, 0, 1],
    ];
    let step = 0;
    const ents = circles.map(([x, y], i) => node(`p-${i}`, x, y, "unvisited", `c${i}`));
    yield {
        stepNumber: step++,
        entities: ents.map((e) => ({ ...e })),
        edges: [],
        description: `Union area of ${circles.length} circle(s) by angular sweep.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    if (circles.length === 0 || circles.some((c) => c[2] <= 0)) {
        yield {
            stepNumber: step++,
            entities: ents.map((e) => ({ ...e })),
            edges: [],
            description: "Degenerate input: empty set or non-positive radius.",
            codeLineNumber: 1,
            layout: "point",
            meta: { area: 0 },
        };
        return;
    }
    const { per } = unionArea(circles);
    for (let i = 0; i < circles.length && step < 11; i += 1) {
        const st = new Map<number, EntityState>([[i, "comparing"]]);
        yield {
            stepNumber: step++,
            entities: ents.map((e, k) => ({ ...e, state: st.get(k) ?? e.state })),
            edges: [],
            description: `Circle ${i}: uncovered-arc contribution = ${(per[i] as number).toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { circle: i, contrib: per[i] },
        };
    }
    const { area } = unionArea(circles);
    yield {
        stepNumber: step++,
        entities: ents.map((e) => ({ ...e, state: "sorted" as EntityState })),
        edges: [],
        description: "Pairwise lens subtracted via uncovered arcs.",
        codeLineNumber: 3,
        layout: "point",
        meta: {},
    };
    yield {
        stepNumber: step++,
        entities: ents.map((e) => ({ ...e, state: "sorted" as EntityState })),
        edges: [],
        description: `Union area = ${area.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { area },
    };
}

const module: AlgorithmModule = {
    id: "circle-union-area-sweep",
    name: "Circle Union Area Sweep",
    category: "geometry",
    complexity: { time: "O(n² log n)", space: "O(n)" },
    defaultInput: {
        circles: [
            [0, 0, 1],
            [1, 0, 1],
        ],
    },
    visualType: "graph",
    run,
};

export default module;

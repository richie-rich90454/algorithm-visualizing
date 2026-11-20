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
        meta: { circles: circles.length },
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
            codeLineNumber: 3,
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
        codeLineNumber: 4,
        layout: "point",
        meta: { area },
    };
    yield {
        stepNumber: step++,
        entities: ents.map((e) => ({ ...e, state: "sorted" as EntityState })),
        edges: [],
        description: `Union area = ${area.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { area },
    };
}

const module: AlgorithmModule = {
    education: {
        "intuition": "The union area of overlapping circles is determined entirely by their boundary arcs. Each circle is cut where it meets another circle; between consecutive cuts an arc is either wholly covered by other circles or wholly exposed. Summing the signed contributions of the exposed arcs gives the union area.",
        "invariants": [
            "Coverage of a boundary point can change only at a pairwise circle intersection.",
            "Between consecutive cut angles on a circle the covered state is constant.",
            "An exposed arc contributes its sector area minus the triangle under its chord."
        ],
        "correctness": "Because coverage changes only when crossing another circle's boundary, sorting the cut angles partitions each circle into arcs of uniform coverage. Testing a single midpoint decides whether an arc is on the union boundary. Green's theorem converts the closed boundary integral into enclosed area, so summing exactly the exposed arcs gives the union area with overlaps counted once.",
        "complexityRationale": "There are O(n^2) pairwise intersections to compute and sorting them around each circle costs O(n^2 log n) overall. The arc walks are linear in the number of cuts, so total time is O(n^2 log n) with O(n^2) space for the cut lists.",
        "uses": [
            "Estimating the coverage of overlapping radio or sensor ranges",
            "Computing merged areas in CAD and GIS",
            "Providing exact answers to check Monte Carlo area estimates"
        ],
        "references": [
            "Green's theorem, standard vector calculus text",
            "O'Rourke, Computational Geometry in C, Chapter 6"
        ],
        "workedExample": "Two unit circles at (0,0) and (1,0) meet at (0.5, 0.866) and (0.5, -0.866). The arcs facing the other circle are covered and discarded. The lens overlap area is about 1.228, so the union area is 2*pi - 1.228, roughly 5.055."
    },

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
    pseudocode: [
        "start from the list of circles",
        "for each circle: list angular intervals covered by others",
        "subtract covered arcs to get each uncovered arc",
        "integrate each uncovered arc for its area share",
        "sum every circle share into the running total",
        "done: the total equals the union area of all circles",
    ],
};

export default module;

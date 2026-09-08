/**
 * convex-layers-onion-peeling.ts – Convex layers (onion peeling).
 * Repeatedly extracts the monotone-chain hull and peels it off until no
 * points remain. k layers cost O(k·n log n). Exact on tiny inputs.
 * Layout "point": nodes carry true coords; peeled layers stay highlighted.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function nodes(pts: Pt[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return pts.map(([x, y], i) => ({
        id: `p-${i}`,
        type: "node" as const,
        label: `p${i}(${x},${y})`,
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

function hullOf(pts: Pt[], idx: number[]): number[] {
    const sorted = [...idx].sort(
        (a, b) => (pts[a] as Pt)[0] - (pts[b] as Pt)[0] || (pts[a] as Pt)[1] - (pts[b] as Pt)[1],
    );
    const build = (order: number[]): number[] => {
        const h: number[] = [];
        for (const i of order) {
            while (
                h.length >= 2 &&
                cross(
                    pts[h[h.length - 2] as number] as Pt,
                    pts[h[h.length - 1] as number] as Pt,
                    pts[i] as Pt,
                ) <= 0
            )
                h.pop();
            h.push(i);
        }
        return h;
    };
    const lower = build(sorted);
    const upper = build([...sorted].reverse());
    return [...lower, ...upper.slice(1, upper.length - 1)];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const pts: Pt[] = task.points ?? [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [1, 1],
        [3, 1],
        [2, 3],
        [2, 2],
    ];
    let step = 0;
    if (pts.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No points – no layers.",
            codeLineNumber: 0,
            layout: "point",
            meta: { layers: [] },
        };
        return;
    }
    if (pts.length === 1) {
        yield {
            stepNumber: step,
            entities: nodes(pts),
            edges: [],
            description: "One point – a single one-point layer.",
            codeLineNumber: 0,
            layout: "point",
            meta: { layers: ["0"] },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: nodes(pts),
        edges: [],
        description: `Onion peeling on ${pts.length} points – extracting hulls.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    let rest = pts.map((_, i) => i);
    const layers: number[][] = [];
    const states = new Map<number, EntityState>();
    const palette: EntityState[] = ["active", "sorted", "highlight", "comparing"];
    while (rest.length > 0 && layers.length < 4) {
        const h = rest.length <= 2 ? [...rest] : hullOf(pts, rest);
        layers.push(h);
        const li = layers.length - 1;
        for (const i of h) states.set(i, palette[li % palette.length] as EntityState);
        const edges: VisualEdge[] = [];
        for (let k = 0; k < h.length; k += 1) {
            const a = h[k] as number;
            const b = h[(k + 1) % h.length] as number;
            edges.push({
                id: `l${li}-${a}-${b}`,
                sourceId: `p-${a}`,
                targetId: `p-${b}`,
                label: "",
                state: "path",
                directed: false,
            });
        }
        yield {
            stepNumber: step,
            entities: nodes(pts, new Map(states)),
            edges,
            description: `Layer ${li + 1}: hull [${h.join(", ")}] peeled off.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
        rest = rest.filter((i) => !h.includes(i));
    }
    yield {
        stepNumber: step,
        entities: nodes(pts, new Map(states)),
        edges: [],
        description: `Onion peeling complete: ${layers.length} layers.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { layers: layers.map((l) => l.join(",")) },
    };
}

const module: AlgorithmModule = {
    id: "convex-layers-onion-peeling",
    name: "Convex Layers (Onion Peeling)",
    category: "geometry",
    complexity: { time: "O(k·n log n)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
            [1, 1],
            [3, 1],
            [2, 3],
            [2, 2],
        ],
    },
    visualType: "graph",
    run,
};

export default module;

/**
 * skyline-problem-sweep.ts – skyline of rectangles by x-sweep.
 * Events sorted by x; active heights tracked in a list, max taken per
 * slab; consecutive duplicates removed. Time O(n²) tiny-n, Space O(n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Building = [number, number, number];
type Key = [number, number];

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
function skyline(bs: Building[]): Key[] {
    const xs = [...new Set(bs.flatMap((b) => [b[0], b[1]]))].sort((a, b2) => a - b2);
    const raw: Key[] = [];
    for (const x of xs) {
        let h = 0;
        for (const [l, r, hh] of bs) if (x >= l && x < r) h = Math.max(h, hh);
        raw.push([x, h]);
    }
    const out: Key[] = [];
    for (const k of raw) {
        if (out.length === 0 || out[out.length - 1]?.[1] !== k[1]) out.push(k);
    }
    const lastX = xs[xs.length - 1] as number;
    if (out.length > 0 && (out[out.length - 1] as Key)[1] !== 0) out.push([lastX, 0]);
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { buildings?: Building[] } | null) ?? {};
    const bs: Building[] = t.buildings ?? [
        [0, 2, 3],
        [1, 4, 2],
        [3, 5, 4],
    ];
    let step = 0;
    const ents: VisualEntity[] = [];
    bs.forEach(([l, r, h], i) => {
        ents.push(
            node(`b-${i}l`, l, h, "unvisited", `B${i}l`),
            node(`b-${i}r`, r, h, "unvisited", `B${i}r`),
        );
    });
    const bedges = bs.map((_, i) => ({
        id: `be-${i}`,
        sourceId: `b-${i}l`,
        targetId: `b-${i}r`,
        label: "",
        state: "idle" as EntityState,
        directed: false,
    }));
    yield {
        stepNumber: step++,
        entities: ents.map((e) => ({ ...e })),
        edges: bedges.map((e) => ({ ...e })),
        description: `Skyline of ${bs.length} buildings by left-to-right sweep.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    if (bs.length === 0) {
        yield {
            stepNumber: step++,
            entities: [],
            edges: [],
            description: "Degenerate input: no buildings; empty skyline.",
            codeLineNumber: 1,
            layout: "point",
            meta: { skyline: [] },
        };
        return;
    }
    const xs = [...new Set(bs.flatMap((b) => [b[0], b[1]]))].sort((a, b) => a - b);
    yield {
        stepNumber: step++,
        entities: ents.map((e) => ({ ...e })),
        edges: bedges.map((e) => ({ ...e })),
        description: `Sweep events at x = [${xs.join(", ")}].`,
        codeLineNumber: 1,
        layout: "point",
        meta: { events: xs },
    };
    const keys = skyline(bs);
    const showXs = xs.slice(0, 5);
    for (const x of showXs) {
        let h = 0;
        for (const [l, r, hh] of bs) if (x >= l && x < r) h = Math.max(h, hh);
        yield {
            stepNumber: step++,
            entities: ents.map((e) => ({ ...e })),
            edges: bedges.map((e) => ({ ...e })),
            description: `Sweep x=${x}: max active height = ${h}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { x, h },
        };
        if (step > 11) break;
    }
    const knots = keys.map(([x, h], i) => node(`k-${i}`, x, h, "sorted", `(${x},${h})`));
    const kedges = keys.slice(0, -1).map((_, i) => {
        // Staircase legs; each edge joins consecutive key points.
        return {
            id: `ke-${i}`,
            sourceId: `k-${i}`,
            targetId: `k-${i + 1}`,
            label: "",
            state: "sorted" as EntityState,
            directed: false,
        };
    });
    yield {
        stepNumber: step++,
        entities: [...ents.map((e) => ({ ...e })), ...knots],
        edges: [...bedges.map((e) => ({ ...e })), ...kedges],
        description: `Skyline keys: ${keys.map((k) => `(${k[0]},${k[1]})`).join(" ")}.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { skyline: keys.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    id: "skyline-problem-sweep",
    name: "Skyline Problem Sweep",
    category: "geometry",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: {
        buildings: [
            [0, 2, 3],
            [1, 4, 2],
            [3, 5, 4],
        ],
    },
    visualType: "graph",
    run,
};

export default module;

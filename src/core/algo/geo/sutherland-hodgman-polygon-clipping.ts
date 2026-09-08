/**
 * sutherland-hodgman-polygon-clipping.ts – Sutherland–Hodgman: clip a subject
 * polygon against each half-plane of an axis-aligned window in turn.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function node(id: string, x: number, y: number, label: string, state: EntityState): VisualEntity {
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
    const task =
        (input as {
            subject?: Pt[];
            window?: { minX: number; minY: number; maxX: number; maxY: number };
        } | null) ?? {};
    const subject: Pt[] = task.subject ?? [
        [1, 1],
        [5, 1],
        [3, 5],
    ];
    const win = task.window ?? { minX: 0, minY: 0, maxX: 4, maxY: 4 };
    let step = 0;
    const show = (
        poly: Pt[],
        code: number,
        desc: string,
        meta: VisualFrame["meta"],
        hl: boolean,
    ) => {
        const ents = poly.map(([x, y], i) =>
            node(
                `q-${i}`,
                Math.round(x * 100) / 100,
                Math.round(y * 100) / 100,
                "",
                (hl ? "sorted" : "unvisited") as EntityState,
            ),
        );
        const edges =
            poly.length >= 2
                ? poly.map((_, i) => ({
                      id: `e-${step}-${i}`,
                      sourceId: `q-${i}`,
                      targetId: `q-${(i + 1) % poly.length}`,
                      label: "",
                      state: "path" as EntityState,
                      directed: false,
                  }))
                : [];
        return {
            stepNumber: step,
            entities: [
                ...ents,
                node("w0", win.minX, win.minY, "", "idle"),
                node("w1", win.maxX, win.maxY, "", "idle"),
            ],
            edges,
            description: desc,
            codeLineNumber: code,
            layout: "point" as const,
            meta,
        };
    };
    if (subject.length < 3) {
        yield {
            stepNumber: step,
            entities: [node("o", 0, 0, "∅", "comparing")],
            edges: [],
            description: "Need a subject polygon with ≥3 vertices.",
            codeLineNumber: 0,
            layout: "point",
            meta: { clipped: [] },
        };
        return;
    }
    yield show(
        subject,
        0,
        `Subject triangle vs window [${win.minX},${win.minY}]–[${win.maxX},${win.maxY}].`,
        {},
        false,
    );
    step += 1;
    const edges4 = [
        {
            name: `x≤${win.maxX}`,
            inside: (p: Pt) => p[0] <= win.maxX,
            cross: (a: Pt, b: Pt): Pt => {
                const t = (win.maxX - a[0]) / (b[0] - a[0]);
                return [win.maxX, a[1] + t * (b[1] - a[1])];
            },
        },
        {
            name: `x≥${win.minX}`,
            inside: (p: Pt) => p[0] >= win.minX,
            cross: (a: Pt, b: Pt): Pt => {
                const t = (win.minX - a[0]) / (b[0] - a[0]);
                return [win.minX, a[1] + t * (b[1] - a[1])];
            },
        },
        {
            name: `y≤${win.maxY}`,
            inside: (p: Pt) => p[1] <= win.maxY,
            cross: (a: Pt, b: Pt): Pt => {
                const t = (win.maxY - a[1]) / (b[1] - a[1]);
                return [a[0] + t * (b[0] - a[0]), win.maxY];
            },
        },
        {
            name: `y≥${win.minY}`,
            inside: (p: Pt) => p[1] >= win.minY,
            cross: (a: Pt, b: Pt): Pt => {
                const t = (win.minY - a[1]) / (b[1] - a[1]);
                return [a[0] + t * (b[0] - a[0]), win.minY];
            },
        },
    ];
    let poly = subject;
    for (let k = 0; k < edges4.length; k += 1) {
        const E = edges4[k]!;
        const out: Pt[] = [];
        for (let i = 0; i < poly.length; i += 1) {
            const cur = poly[i]!,
                prev = poly[(i + poly.length - 1) % poly.length]!;
            const ci = E.inside(cur),
                pi = E.inside(prev);
            if (ci && pi) out.push(cur);
            else if (ci) {
                out.push(E.cross(prev, cur));
                out.push(cur);
            } else if (pi) out.push(E.cross(prev, cur));
        }
        poly = out;
        yield show(poly, 1, `After ${E.name}: ${poly.length} vertices.`, {}, false);
        step += 1;
    }
    yield show(
        poly,
        2,
        `Clipped polygon: ${poly.length} vertices inside the window.`,
        { clipped: poly.map(([x, y]) => `${x},${y}`) },
        true,
    );
}

const module: AlgorithmModule = {
    id: "sutherland-hodgman-polygon-clipping",
    name: "Sutherland–Hodgman Polygon Clipping",
    category: "geometry",
    complexity: { time: "O(n·m)", space: "O(n)" },
    defaultInput: {
        subject: [
            [1, 1],
            [5, 1],
            [3, 5],
        ],
        window: { minX: 0, minY: 0, maxX: 4, maxY: 4 },
    },
    visualType: "graph",
    run,
};

export default module;

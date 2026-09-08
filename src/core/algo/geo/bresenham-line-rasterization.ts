/**
 * bresenham-line-rasterization.ts – Bresenham's integer line algorithm.
 * Default (0,0)→(5,3) yields 6 pixels: (0,0),(1,1),(2,1),(3,2),(4,2),(5,3).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

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
    const task = (input as { from?: [number, number]; to?: [number, number] } | null) ?? {};
    const from: [number, number] = task.from ?? [0, 0];
    const to: [number, number] = task.to ?? [5, 3];
    let step = 0;
    let [x0, y0] = from;
    const [x1, y1] = to;
    const dx = Math.abs(x1 - x0),
        dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1,
        sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    const pixels: Array<[number, number]> = [];
    let guard = 0;
    for (;;) {
        pixels.push([x0, y0]);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y0 += sy;
        }
        if (++guard > 500) break;
    }
    if (pixels.length === 0) {
        yield {
            stepNumber: step,
            entities: [node("o", 0, 0, "∅", "idle")],
            edges: [],
            description: "Empty segment – nothing to rasterize.",
            codeLineNumber: 0,
            layout: "point",
            meta: { pixels: [] },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [
            node("a", from[0], from[1], "from", "highlight"),
            node("b", to[0], to[1], "to", "highlight"),
        ],
        edges: [],
        description: `Rasterizing (${from})→(${to}) with integer error term.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    const per = Math.max(1, Math.ceil(pixels.length / 4));
    for (let k = 0; k < pixels.length; k += per) {
        const chunk = pixels.slice(0, Math.min(k + per, pixels.length));
        yield {
            stepNumber: step,
            entities: chunk.map(([x, y], i) =>
                node(`px-${i}`, x, y, "", i === chunk.length - 1 ? "comparing" : "sorted"),
            ),
            edges: [],
            description: `Pixel ${Math.min(k + per, pixels.length)}/${pixels.length}: (${chunk[chunk.length - 1]}) lit.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: pixels.map(([x, y], i) => node(`px-${i}`, x, y, "", "sorted")),
        edges: [],
        description: `Done: ${pixels.length} pixels, 8-connected staircase.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { pixels: pixels.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    id: "bresenham-line-rasterization",
    name: "Bresenham Line Rasterization",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { from: [0, 0], to: [5, 3] },
    visualType: "graph",
    run,
};

export default module;

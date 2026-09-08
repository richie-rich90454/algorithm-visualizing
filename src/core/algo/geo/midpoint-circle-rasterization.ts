/**
 * midpoint-circle-rasterization.ts – Midpoint circle algorithm: integer
 * decision variable walks the 2nd octant, mirrored to all eight.
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
    const task = (input as { center?: [number, number]; radius?: number } | null) ?? {};
    const [cx, cy] = task.center ?? [0, 0];
    const r = task.radius ?? 3;
    let step = 0;
    if (!(r >= 1)) {
        yield {
            stepNumber: step,
            entities: [node("c", cx, cy, "c", "comparing")],
            edges: [],
            description: "Radius must be ≥ 1.",
            codeLineNumber: 0,
            layout: "point",
            meta: { pixels: [] },
        };
        return;
    }
    const oct: Array<[number, number]> = [];
    let x = 0,
        y = r,
        d = 1 - r;
    while (x <= y) {
        oct.push([x, y]);
        if (d < 0) d += 2 * x + 3;
        else {
            d += 2 * (x - y) + 5;
            y -= 1;
        }
        x += 1;
    }
    const seen = new Map<string, [number, number]>();
    for (const [ox, oy] of oct) {
        for (const [sx, sy] of [
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
        ]) {
            for (const [px, py] of [
                [ox, oy],
                [oy, ox],
            ]) {
                const X = cx + sx * px,
                    Y = cy + sy * py;
                seen.set(`${X},${Y}`, [X, Y]);
            }
        }
    }
    const pixels = [...seen.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    yield {
        stepNumber: step,
        entities: [node("c", cx, cy, "c", "highlight")],
        edges: [],
        description: `Midpoint circle c=(${cx},${cy}) r=${r}: walking octant x≤y.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    const per = Math.max(1, Math.ceil(oct.length / 3));
    for (let k = 0; k < oct.length; k += per) {
        const done = oct.slice(0, Math.min(k + per, oct.length));
        const ents: VisualEntity[] = [node("c", cx, cy, "c", "highlight")];
        done.forEach(([ox, oy], i) => {
            const X = cx + ox,
                Y = cy + oy;
            ents.push(
                node(`px-${X}-${Y}`, X, Y, "", i === done.length - 1 ? "comparing" : "sorted"),
            );
        });
        yield {
            stepNumber: step,
            entities: ents,
            edges: [],
            description: `Octant step ${Math.min(k + per, oct.length)}/${oct.length}: (${done[done.length - 1]}) mirrored ×8.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: [
            node("c", cx, cy, "c", "highlight"),
            ...pixels.map(([X, Y]) => node(`px-${X}-${Y}`, X, Y, "", "sorted")),
        ],
        edges: [],
        description: `Done: ${pixels.length} pixels on the circle.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { pixels: pixels.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    id: "midpoint-circle-rasterization",
    name: "Midpoint Circle Rasterization",
    category: "geometry",
    complexity: { time: "O(r)", space: "O(r)" },
    defaultInput: { center: [0, 0], radius: 3 },
    visualType: "graph",
    run,
};

export default module;

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
        codeLineNumber: 2,
        layout: "point",
        meta: { center: [cx, cy], radius: r },
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
            codeLineNumber: 3,
            layout: "point",
            meta: { octantStep: Math.min(k + per, oct.length), total: oct.length },
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
        codeLineNumber: 5,
        layout: "point",
        meta: { pixels: pixels.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    education: {
        "intuition": "The midpoint circle algorithm draws a circle using only integer arithmetic. It walks the arc in one octant, deciding at each step whether the next pixel is on the circle outline or just inside it by evaluating a decision variable at the midpoint between two candidates, then mirrors the pixel into all eight octants.",
        "invariants": [
            "The decision variable is the circle equation evaluated at the midpoint of the two candidate pixels.",
            "The current pixel is always the closest grid point to the true circle in that octant.",
            "Mirroring produces pixels symmetric under all eight octant transformations."
        ],
        "correctness": "If the midpoint lies inside the circle the outline is farther toward the outside candidate, so choosing it keeps the drawn pixel closer to the true circle; otherwise the inside candidate is closer. Updating the decision variable incrementally preserves this comparison as x increases. Stopping when x reaches y ends the octant exactly at the 45 degree point, and the eight-way symmetry fills the complete circle.",
        "complexityRationale": "The loop runs about r steps along one octant and writes eight pixels per step, giving O(r) time. Only a few integer accumulators are kept, so space is O(1) besides the output.",
        "uses": [
            "Drawing circles in raster graphics and fonts",
            "Generating circular masks in image processing",
            "Hardware circle primitives in embedded displays"
        ],
        "references": [
            "Bresenham, A Linear Algorithm for Incremental Digital Display of Circular Arcs, Communications of the ACM 20 (1977)",
            "Foley et al., Computer Graphics: Principles and Practice, Chapter 3"
        ],
        "workedExample": "For radius r = 5, the algorithm starts at (0,5) with decision value 1 - r = -4. It advances x while keeping y = 5 until the midpoint test turns positive, then drops y, continuing until x reaches y. Each chosen pixel is mirrored to the other seven octants."
    },

    id: "midpoint-circle-rasterization",
    name: "Midpoint Circle Rasterization",
    category: "geometry",
    complexity: { time: "O(r)", space: "O(r)" },
    defaultInput: { center: [0, 0], radius: 3 },
    visualType: "graph",
    run,
    pseudocode: [
        "start at the top of the circle with decision value zero",
        "light the current octant pixel",
        "test the midpoint to pick east or southeast next",
        "update the decision value for the chosen step",
        "mirror each octant pixel across all eight octants",
        "done: mirrored pixels rasterize the full circle",
    ],
};

export default module;

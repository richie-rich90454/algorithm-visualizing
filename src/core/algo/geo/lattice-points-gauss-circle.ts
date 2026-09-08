/**
 * lattice-points-gauss-circle.ts – Gauss circle problem: count integer
 * lattice points with x²+y²≤r². Default r=2 gives 13 points.
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
    const task = (input as { radius?: number } | null) ?? {};
    const r = task.radius ?? 2;
    let step = 0;
    if (!(r >= 0)) {
        yield {
            stepNumber: step,
            entities: [node("o", 0, 0, "∅", "comparing")],
            edges: [],
            description: "Radius must be ≥ 0.",
            codeLineNumber: 0,
            layout: "point",
            meta: { count: 0 },
        };
        return;
    }
    const R = Math.ceil(r);
    const inside: Array<[number, number]> = [];
    const outside: Array<[number, number]> = [];
    for (let x = -R - 1; x <= R + 1; x += 1)
        for (let y = -R - 1; y <= R + 1; y += 1) {
            (x * x + y * y <= r * r + 1e-9 ? inside : outside).push([x, y]);
        }
    const shells = new Map<number, Array<[number, number]>>();
    for (const p of inside) {
        const s = p[0] * p[0] + p[1] * p[1];
        if (!shells.has(s)) shells.set(s, []);
        shells.get(s)!.push(p);
    }
    const keys = [...shells.keys()].sort((a, b) => a - b);
    yield {
        stepNumber: step,
        entities: [node("o", 0, 0, "r=" + r, "highlight")],
        edges: [],
        description: `Counting lattice points with x²+y²≤${r}² (πr²≈${(Math.PI * r * r).toFixed(2)}).`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    const shown: VisualEntity[] = [];
    for (let s = 0; s < keys.length && step < 10; s += 1) {
        for (const [x, y] of shells.get(keys[s]!)!)
            shown.push(node(`q-${x}-${y}`, x, y, "", "sorted"));
        yield {
            stepNumber: step,
            entities: [...shown.map((e) => ({ ...e })), node("o", 0, 0, "r=" + r, "highlight")],
            edges: [],
            description: `Shell x²+y²=${keys[s]}: ${shown.length} inside so far.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: [...shown.map((e) => ({ ...e })), node("o", 0, 0, "r=" + r, "highlight")],
        edges: [],
        description: `N(${r})=${inside.length}; error vs πr² is ${(inside.length - Math.PI * r * r).toFixed(2)}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { count: inside.length, points: inside.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    id: "lattice-points-gauss-circle",
    name: "Lattice Points (Gauss Circle)",
    category: "geometry",
    complexity: { time: "O(r²)", space: "O(r²)" },
    defaultInput: { radius: 2 },
    visualType: "graph",
    run,
};

export default module;

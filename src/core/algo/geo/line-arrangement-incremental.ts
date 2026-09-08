/**
 * line-arrangement-incremental.ts – Incremental line arrangement: insert lines
 * one by one, adding each new pairwise intersection as a vertex node.
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
    const task = (input as { lines?: Array<{ m: number; b: number }> } | null) ?? {};
    const lines = task.lines ?? [
        { m: 1, b: 0 },
        { m: -1, b: 4 },
        { m: 0, b: 1 },
    ];
    let step = 0;
    if (lines.length === 0) {
        yield {
            stepNumber: step,
            entities: [node("o", 0, 0, "∅", "idle")],
            edges: [],
            description: "No lines – arrangement is empty.",
            codeLineNumber: 0,
            layout: "point",
            meta: { vertices: [] },
        };
        return;
    }
    const X0 = -1,
        X1 = 5;
    const inter = (
        a: { m: number; b: number },
        b: { m: number; b: number },
    ): [number, number] | null => {
        if (a.m === b.m) return null;
        const x = (b.b - a.b) / (a.m - b.m);
        return [x, a.m * x + a.b];
    };
    const ents: VisualEntity[] = [];
    const edges: {
        id: string;
        sourceId: string;
        targetId: string;
        label: string;
        state: EntityState;
        directed: boolean;
    }[] = [];
    const vertices: Array<[number, number]> = [];
    const emit = (desc: string, code: number, meta: VisualFrame["meta"]) => ({
        stepNumber: step,
        entities: ents.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: desc,
        codeLineNumber: code,
        layout: "point" as const,
        meta,
    });
    for (let i = 0; i < lines.length; i += 1) {
        const L = lines[i]!;
        ents.push(node(`l-${i}-0`, X0, L.m * X0 + L.b, "", "idle"));
        ents.push(node(`l-${i}-1`, X1, L.m * X1 + L.b, "", "idle"));
        edges.push({
            id: `line-${i}`,
            sourceId: `l-${i}-0`,
            targetId: `l-${i}-1`,
            label: `y=${L.m}x${L.b < 0 ? L.b : "+" + L.b}`,
            state: "idle",
            directed: false,
        });
        for (let j = 0; j < i; j += 1) {
            const p = inter(lines[j]!, L);
            if (p) {
                vertices.push([Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
                ents.push(node(`v-${vertices.length - 1}`, p[0], p[1], "×", "comparing"));
            }
        }
        yield emit(
            `Inserted line ${i + 1}/${lines.length}; ${vertices.length} vertices so far.`,
            1,
            {},
        );
        step += 1;
        if (step > 10) break;
    }
    const done = ents.map((e) => ({
        ...e,
        state: e.id.startsWith("v-") ? ("sorted" as EntityState) : e.state,
    }));
    yield {
        stepNumber: step,
        entities: done,
        edges: edges.map((e) => ({ ...e })),
        description: `Arrangement of ${lines.length} lines with ${vertices.length} vertices.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { vertices: vertices.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    id: "line-arrangement-incremental",
    name: "Line Arrangement (Incremental)",
    category: "geometry",
    complexity: { time: "O(n²)", space: "O(n²)" },
    defaultInput: {
        lines: [
            { m: 1, b: 0 },
            { m: -1, b: 4 },
            { m: 0, b: 1 },
        ],
    },
    visualType: "graph",
    run,
};

export default module;

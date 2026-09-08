/**
 * k-means-lloyd.ts – K-means (Lloyd's algorithm), k=2, fixed dataset.
 * Alternates assignment (nearest centroid) and update (cluster mean) for at
 * most 4 iterations on a fixed 6-point set. Deterministic, O(k·n·i).
 * Layout "point": points p-i plus centroid nodes m-0/m-1, true coords.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

const DATA: Pt[] = [
    [0, 0],
    [1, 0],
    [0, 1],
    [5, 5],
    [6, 5],
    [5, 6],
];

function entities(pts: Pt[], assign: number[], cents: Pt[]): VisualEntity[] {
    const states: EntityState[] = ["sorted", "active"];
    const out: VisualEntity[] = pts.map(([x, y], i) => ({
        id: `p-${i}`,
        type: "node" as const,
        label: `p${i}(${x},${y})→C${assign[i] ?? 0}`,
        value: [x, y],
        state: states[assign[i] ?? 0] ?? "unvisited",
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index: i, cluster: assign[i] ?? 0 },
    }));
    cents.forEach(([x, y], c) => {
        out.push({
            id: `m-${c}`,
            type: "node" as const,
            label: `μ${c}(${Math.round(x * 100) / 100},${Math.round(y * 100) / 100})`,
            value: [x, y],
            state: "highlight",
            x,
            y,
            width: 0,
            height: 0,
            metadata: { kind: "centroid", cluster: c },
        });
    });
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const pts: Pt[] = task.points ?? DATA;
    let step = 0;
    if (pts.length < 2) {
        yield {
            stepNumber: step,
            entities: entities(
                pts,
                pts.map(() => 0),
                [],
            ),
            edges: [],
            description: "Need ≥2 points for k=2.",
            codeLineNumber: 0,
            layout: "point",
            meta: { assignment: [] },
        };
        return;
    }
    let cents: Pt[] = [pts[0] as Pt, pts[3 % pts.length] as Pt];
    let assign = pts.map(() => 0);
    yield {
        stepNumber: step,
        entities: entities(pts, assign, cents),
        edges: [],
        description: `Lloyd k=2: seeds μ0=${cents[0]}, μ1=${cents[1]}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    for (let it = 0; it < 4; it += 1) {
        assign = pts.map(([x, y]) =>
            Math.hypot(x - (cents[0] as Pt)[0], y - (cents[0] as Pt)[1]) <=
            Math.hypot(x - (cents[1] as Pt)[0], y - (cents[1] as Pt)[1])
                ? 0
                : 1,
        );
        yield {
            stepNumber: step,
            entities: entities(pts, assign, cents),
            edges: [],
            description: `Iter ${it + 1}: assigned [${assign.join(", ")}].`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
        const next: Pt[] = [0, 1].map((c) => {
            const members = pts.filter((_, i) => assign[i] === c);
            if (members.length === 0) return cents[c] as Pt;
            return [
                members.reduce((s, p) => s + p[0], 0) / members.length,
                members.reduce((s, p) => s + p[1], 0) / members.length,
            ];
        });
        const moved =
            Math.hypot(next[0][0] - (cents[0] as Pt)[0], next[0][1] - (cents[0] as Pt)[1]) +
            Math.hypot(next[1][0] - (cents[1] as Pt)[0], next[1][1] - (cents[1] as Pt)[1]);
        cents = next;
        yield {
            stepNumber: step,
            entities: entities(pts, assign, cents),
            edges: [],
            description: `Iter ${it + 1}: means μ0=${cents[0].map((v) => Math.round(v * 100) / 100)}, μ1=${cents[1].map((v) => Math.round(v * 100) / 100)}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: {},
        };
        step += 1;
        if (moved < 1e-9) break;
    }
    yield {
        stepNumber: step,
        entities: entities(pts, assign, cents),
        edges: [],
        description: `Converged: cluster 0 = {${pts.map((_, i) => i).filter((i) => assign[i] === 0)}}, cluster 1 = {${pts.map((_, i) => i).filter((i) => assign[i] === 1)}}.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { assignment: assign, centroids: cents.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    id: "k-means-lloyd",
    name: "K-Means (Lloyd)",
    category: "geometry",
    complexity: { time: "O(k·n·i)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [1, 0],
            [0, 1],
            [5, 5],
            [6, 5],
            [5, 6],
        ],
    },
    visualType: "graph",
    run,
};

export default module;

/**
 * hierarchical-agglomerative-clustering.ts – Single-linkage agglomerative
 * clustering: repeatedly merge the closest pair until k=2 clusters remain.
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
    const task = (input as { points?: Array<[number, number]>; k?: number } | null) ?? {};
    const pts: Array<[number, number]> = task.points ?? [
        [0, 0],
        [0.5, 0],
        [5, 0],
        [5.5, 0],
    ];
    const k = task.k ?? 2;
    let step = 0;
    if (pts.length < 2) {
        yield {
            stepNumber: step,
            entities: pts.map(([x, y], i) => node(`p-${i}`, x, y, String(i), "comparing")),
            edges: [],
            description: "Need ≥2 points to cluster.",
            codeLineNumber: 0,
            layout: "point",
            meta: { clusters: [] },
        };
        return;
    }
    const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const cdist = (A: number[], B: number[]) => {
        let m = Infinity;
        for (const a of A) for (const b of B) m = Math.min(m, dist(pts[a]!, pts[b]!));
        return m;
    };
    let clusters: number[][] = pts.map((_, i) => [i]);
    const palette: EntityState[] = ["swapped", "sorted", "active", "highlight", "comparing"];
    const paint = (list: number[][]) => {
        const cOf = new Map<number, number>();
        list.forEach((c, ci) => c.forEach((p) => cOf.set(p, ci)));
        return pts.map(([x, y], i) =>
            node(`p-${i}`, x, y, `C${cOf.get(i)}`, palette[(cOf.get(i) ?? 0) % palette.length]!),
        );
    };
    yield {
        stepNumber: step,
        entities: paint(clusters),
        edges: [],
        description: `Start: ${clusters.length} singleton clusters, target k=${k}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    while (clusters.length > k && step < 10) {
        let bi = 0,
            bj = 1,
            bd = Infinity;
        for (let i = 0; i < clusters.length; i += 1)
            for (let j = i + 1; j < clusters.length; j += 1) {
                const d = cdist(clusters[i]!, clusters[j]!);
                if (d < bd) {
                    bd = d;
                    bi = i;
                    bj = j;
                }
            }
        const merged = [...clusters[bi]!, ...clusters[bj]!];
        clusters = clusters.filter((_, i) => i !== bi && i !== bj);
        clusters.push(merged);
        yield {
            stepNumber: step,
            entities: paint(clusters),
            edges: [],
            description: `Merged at distance ${bd.toFixed(2)} → ${clusters.length} clusters.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: paint(clusters),
        edges: [],
        description: `Final ${clusters.length} clusters: ${clusters.map((c) => `[${c.join(",")}]`).join(" ")}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { clusters: clusters.map((c) => c.join(",")) },
    };
}

const module: AlgorithmModule = {
    id: "hierarchical-agglomerative-clustering",
    name: "Hierarchical Agglomerative Clustering",
    category: "geometry",
    complexity: { time: "O(n³)", space: "O(n²)" },
    defaultInput: {
        points: [
            [0, 0],
            [0.5, 0],
            [5, 0],
            [5.5, 0],
        ],
        k: 2,
    },
    visualType: "graph",
    run,
};

export default module;

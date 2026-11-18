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
        codeLineNumber: 1,
        layout: "point",
        meta: { clusters: clusters.length, target: k },
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
            codeLineNumber: 3,
            layout: "point",
            meta: { mergedAt: bd, clusters: clusters.length },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: paint(clusters),
        edges: [],
        description: `Final ${clusters.length} clusters: ${clusters.map((c) => `[${c.join(",")}]`).join(" ")}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { clusters: clusters.map((c) => c.join(",")) },
    };
}

const module: AlgorithmModule = {
    education: {
        "intuition": "Agglomerative clustering starts with every point in its own cluster and repeatedly merges the closest pair until the desired number of clusters remains. With single linkage, the distance between two clusters is the minimum distance over all cross-cluster point pairs, which tends to form long chained clusters.",
        "invariants": [
            "Every point belongs to exactly one cluster at each step.",
            "The merge distance is nondecreasing as clusters grow.",
            "Single-link distance is the minimum pairwise distance between the two clusters."
        ],
        "correctness": "Choosing the globally closest pair and merging it is the greedy step defining single-linkage hierarchical clustering. Because single-link distance is the minimum over cross pairs, the merge corresponds to adding the shortest edge in the single-link dendrogram. Inductively the cluster hierarchy equals the connected components obtained by thresholding the minimum spanning tree of the points.",
        "complexityRationale": "Recomputing all cross-cluster pair distances after each of O(n) merges costs O(n^3) in the straightforward version, with O(n^2) space for the distance matrix. Using a priority queue and updating only affected pairs improves this in implementations.",
        "uses": [
            "Taxonomy construction in biology",
            "Grouping similar documents or users",
            "Creating dendrograms for exploratory data analysis"
        ],
        "references": [
            "Han, Kamber, and Pei, Data Mining: Concepts and Techniques, Chapter 10",
            "Jain, Murty, and Flynn, Data Clustering: A Review, ACM Computing Surveys 31 (1999)"
        ],
        "workedExample": "Points (0,0), (1,0), (5,0), (6,0): the closest pairs are the two unit gaps. Merge (0,0) with (1,0) and (5,0) with (6,0), each at height 1, then merge the two clusters at height 4 using the single-link distance between (1,0) and (5,0)."
    },

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
    pseudocode: [
        "start with every point as its own cluster",
        "find the closest pair of clusters",
        "merge that pair and record the linkage distance",
        "repeat until k clusters remain",
        "done: final clusters group nearby points together",
    ],
};

export default module;

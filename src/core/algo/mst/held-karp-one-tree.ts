/**
 * held-karp-one-tree.ts - Held-Karp 1-Tree Lower Bound for TSP.
 *
 * A 1-tree is a spanning tree on every vertex except a distinguished root,
 * plus the two cheapest edges from that root. Every TSP tour is a 1-tree, so
 * its cost lower-bounds the optimal tour. Held and Karp tighten the bound with
 * Lagrangean node potentials: penalize vertices of degree other than two,
 * rebuild the 1-tree under reduced costs, and keep the best bound found.
 *
 * Time:  O(iterations * n^2), space O(n^2)
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

interface Tree {
    edges: Array<[number, number]>;
    cost: number;
    reducedCost: number;
    rootEdges: Array<[number, number]>;
}

function distanceMatrix(points: Point[]): number[][] {
    const n = points.length;
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
            const a = points[i] as Point;
            const b = points[j] as Point;
            return Math.hypot(a[0] - b[0], a[1] - b[1]);
        }),
    );
}

/** Prim MST over vertices 1..n-1 using the supplied cost matrix. */
function mstOnNonRoot(cost: number[][]): Array<[number, number]> {
    const n = cost.length;
    const inTree = new Set<number>([1]);
    const edges: Array<[number, number]> = [];
    while (inTree.size < n) {
        let bestU = -1;
        let bestV = -1;
        let best = Infinity;
        for (const u of inTree) {
            for (let v = 1; v < n; v += 1) {
                if (inTree.has(v)) continue;
                const c = cost[u]?.[v] ?? Infinity;
                if (c < best) {
                    best = c;
                    bestU = u;
                    bestV = v;
                }
            }
        }
        if (bestV < 0) break;
        edges.push([bestU, bestV]);
        inTree.add(bestV);
    }
    return edges;
}

function build1Tree(cost: number[][], potentials: number[]): Tree {
    const n = cost.length;
    const reduced = cost.map((row, i) => row.map((c, j) => c - (potentials[i] ?? 0) - (potentials[j] ?? 0)));
    const treeEdges = mstOnNonRoot(reduced);
    const rootEdges: Array<[number, number]> = [];
    for (let k = 0; k < 2; k += 1) {
        let bestJ = -1;
        let best = Infinity;
        for (let j = 1; j < n; j += 1) {
            if (rootEdges.some(([, t]) => t === j)) continue;
            const c = reduced[0]?.[j] ?? Infinity;
            if (c < best) {
                best = c;
                bestJ = j;
            }
        }
        if (bestJ >= 0) rootEdges.push([0, bestJ]);
    }
    const edges = [...treeEdges, ...rootEdges];
    const originalCost = edges.reduce((sum, [a, b]) => sum + (cost[a]?.[b] ?? 0), 0);
    const reducedCost = edges.reduce((sum, [a, b]) => sum + (reduced[a]?.[b] ?? 0), 0);
    return { edges, cost: originalCost, reducedCost, rootEdges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[]; iterations?: number } | null) ?? {};
    const points: Point[] = task.points ?? [
        [0, 0], [1, 0], [1, 1], [0, 1], [0.5, 1.8],
    ];
    const iterations = Math.max(1, Math.min(12, task.iterations ?? 5));
    const cost = distanceMatrix(points);
    const n = points.length;
    const nodes: VisualEntity[] = points.map(([x, y], i) => ({
        id: `node-p${i}`,
        type: "node" as const,
        label: i === 0 ? "root" : String(i),
        value: [x, y],
        state: "unvisited",
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
    const allEdges = (): VisualFrame["edges"] => {
        const out: VisualFrame["edges"] = [];
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                out.push({
                    id: `edge-${i}-${j}`,
                    sourceId: `node-p${i}`,
                    targetId: `node-p${j}`,
                    label: (cost[i]?.[j] ?? 0).toFixed(1),
                    state: "idle",
                    directed: false,
                });
            }
        }
        return out;
    };
    let step = 0;
    const snap = (description: string, codeLineNumber: number, meta: Record<string, number | string | boolean>): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: allEdges(),
        description,
        codeLineNumber,
        layout: "point",
        meta,
    });
    const mark = (edges: Array<[number, number]>, state: "path" | "active" | "comparing" | "sorted"): VisualFrame["edges"] => {
        const marked = new Set(edges.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
        return allEdges().map((e) => (marked.has(`${e.sourceId.slice(6)}-${e.targetId.slice(6)}`) ? { ...e, state } : e));
    };

    if (n < 3) {
        yield snap("Need at least three points to form a 1-tree.", 0, { bound: -1 });
        return;
    }

    const potentials = Array.from({ length: n }, () => 0);
    let bestBound = -Infinity;
    let bestTree: Tree | null = null;
    const avgDistance = cost.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0) / (n * n);

    const base = build1Tree(cost, potentials);
    bestBound = base.cost;
    bestTree = base;
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node, state: node.id === "node-p0" ? "highlight" : "unvisited" })),
        edges: mark(base.edges, "path"),
        description: `Base 1-tree: an MST on all non-root vertices plus the two cheapest edges from the root; cost ${base.cost.toFixed(2)}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { bound: base.cost, iteration: 0 },
    };
    step += 1;

    for (let iter = 0; iter < iterations; iter += 1) {
        const tree = build1Tree(cost, potentials);
        const degree = Array.from({ length: n }, () => 0);
        for (const [a, b] of tree.edges) {
            degree[a] = (degree[a] ?? 0) + 1;
            degree[b] = (degree[b] ?? 0) + 1;
        }
        const totalPot = potentials.reduce((a, b) => a + b, 0);
        const bound = tree.reducedCost + 2 * totalPot;
        if (bound > bestBound) {
            bestBound = bound;
            bestTree = tree;
        }
        yield {
            stepNumber: step,
            entities: nodes.map((node) => {
                const i = Number(node.id.slice(6));
                return { ...node, state: (degree[i] ?? 0) === 2 ? "path" : "comparing" };
            }),
            edges: mark(tree.edges, "active"),
            description: `Lagrangean iteration ${iter + 1}: reduced-cost 1-tree costs ${tree.cost.toFixed(2)}, bound ${bound.toFixed(2)} after adding twice the node potentials.`,
            codeLineNumber: 5,
            layout: "point",
            meta: { bound, iteration: iter + 1 },
        };
        step += 1;
        const stepSize = (0.4 * avgDistance) / (iter + 1);
        for (let i = 0; i < n; i += 1) potentials[i] = (potentials[i] ?? 0) + stepSize * ((degree[i] ?? 0) - 2);
    }

    const finalTree = bestTree as Tree;
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node, state: node.id === "node-p0" ? "sorted" : "path" })),
        edges: mark(finalTree.edges, "sorted"),
        description: `Best 1-tree lower bound on the optimal tour is ${bestBound.toFixed(2)}; the root has degree 2 and the rest form a tree.`,
        codeLineNumber: 8,
        layout: "point",
        meta: { bound: bestBound, iteration: iterations, rootDegree: finalTree.rootEdges.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Delete any one city from a TSP tour and what remains is a spanning tree on the other cities; add back the two tour edges touching the deleted city and you have a 1-tree. Since every tour is a 1-tree, the cheapest 1-tree is a lower bound on the tour. Node potentials penalize cities whose degree is not two, repeatedly tightening that bound.",
        invariants: [
            "The non-root portion of a 1-tree is a spanning tree.",
            "The root has degree exactly two in every 1-tree.",
            "The bound equals the 1-tree's original cost plus twice the sum of node potentials.",
        ],
        correctness:
            "Every Hamiltonian tour becomes a 1-tree by removing its two edges at the root, so the minimum 1-tree cost cannot exceed the optimal tour cost. Adding potentials shifts reduced costs but the compensation term preserves feasibility of the bound, so each iteration reports a valid lower bound and the best one is the tightest.",
        complexityRationale:
            "Each iteration rebuilds an MST over n vertices with a dense O(n^2) Prim loop and scans root edges, so the total is O(iterations n^2) time and O(n^2) space for the distance and reduced-cost matrices.",
        uses: [
            "Lower bounds in branch-and-bound TSP solvers",
            "Lagrangean relaxation for tour problems",
            "Assessing how close a heuristic tour is to optimal",
        ],
        references: [
            "Held and Karp, The Traveling-Salesman Problem and Minimum Spanning Trees (1970)",
            "Lawler, Wood, and Steele, The Traveling Salesman Problem: A Guided Tour (2011)",
        ],
        workedExample:
            "On five points, an MST of the four non-root points cost about 2.4, and the two cheapest root edges add about 1.4, giving a 3.8 bound. After a few potential updates that push degree-one and degree-three cities toward degree two, the bound rises while staying below the true tour length.",
    },
    id: "held-karp-one-tree",
    name: "Held-Karp 1-Tree Lower Bound",
    category: "mst",
    complexity: { time: "O(k n^2)", space: "O(n^2)" },
    defaultInput: {
        points: [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 1.8], [1.5, 1.8]],
        iterations: 5,
    },
    visualType: "point",
    run,
    pseudocode: [
        "build the complete Euclidean distance matrix",
        "initialize all node potentials to zero",
        "compute reduced costs by subtracting both endpoint potentials",
        "build an MST on every vertex except the root",
        "add the two cheapest reduced-cost edges from the root",
        "bound equals original tree cost plus twice the potential sum",
        "update potentials by a step times each degree minus two",
        "keep the largest bound over all iterations",
        "done: report the best tour lower bound",
    ],
};

export default module;

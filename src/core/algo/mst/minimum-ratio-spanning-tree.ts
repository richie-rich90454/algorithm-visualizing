/**
 * minimum-ratio-spanning-tree.ts - Minimum Ratio Spanning Tree
 *
 * Finds the spanning tree minimizing total cost divided by total weight. For a
 * candidate ratio lambda, assign each edge the adjusted cost (cost - lambda *
 * weight) and build a normal minimum spanning tree. The minimum adjusted total
 * is positive below the optimal ratio and nonpositive at or above it, so a
 * binary search on lambda locates the optimum.
 *
 * Time: O(I * E log E) for I search iterations. Space: O(V + E).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualEdge, VisualFrame } from "@/types";

type WeightedEdge = [number, number, number, number]; // source, target, cost, weight

interface Tree {
    edges: number[];
    cost: number;
    weight: number;
    ratio: number;
    adjusted: number;
}

function find(parent: number[], x: number): number {
    while (parent[x] !== x) {
        parent[x] = parent[parent[x]] ?? x;
        x = parent[x] ?? x;
    }
    return x;
}

/** Kruskal on adjusted edge costs; returns the chosen edge indices and totals. */
function mstForLambda(edges: WeightedEdge[], nodes: number, lambda: number): Tree {
    const order = edges.map((_, i) => i).sort((a, b) => {
        const ea = edges[a];
        const eb = edges[b];
        if (!ea || !eb) return 0;
        return (ea[2] - lambda * ea[3]) - (eb[2] - lambda * eb[3]);
    });
    const parent = Array.from({ length: nodes }, (_, i) => i);
    const chosen: number[] = [];
    let cost = 0;
    let weight = 0;
    let adjusted = 0;
    for (const index of order) {
        if (chosen.length === nodes - 1) break;
        const edge = edges[index];
        if (!edge) continue;
        const rootA = find(parent, edge[0]);
        const rootB = find(parent, edge[1]);
        if (rootA === rootB) continue;
        parent[rootA] = rootB;
        chosen.push(index);
        cost += edge[2];
        weight += edge[3];
        adjusted += edge[2] - lambda * edge[3];
    }
    return {
        edges: chosen.sort((a, b) => a - b),
        cost,
        weight,
        ratio: weight > 0 ? cost / weight : Number.POSITIVE_INFINITY,
        adjusted,
    };
}

function makeEntities(
    nodes: number,
    edges: WeightedEdge[],
    chosen: Set<number>,
    lambda: number,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = Array.from({ length: nodes }, (_, i) => ({
        id: `node-${i}`,
        type: "node" as const,
        label: String(i),
        value: i,
        state: "visited" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { node: i },
    }));
    const visualEdges: VisualEdge[] = edges.map((edge, i) => ({
        id: `edge-${i}`,
        sourceId: `node-${edge[0]}`,
        targetId: `node-${edge[1]}`,
        label: (edge[2] - lambda * edge[3]).toFixed(2),
        state: chosen.has(i) ? ("path" as EntityState) : ("idle" as EntityState),
        directed: false,
    }));
    return { entities, edges: visualEdges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { nodes?: number; edges?: WeightedEdge[] } | null) ?? {};
    const edges: WeightedEdge[] = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges.map((e) => [Number(e[0]), Number(e[1]), Number(e[2]), Number(e[3])] as WeightedEdge)
        : [
              [0, 1, 4, 1], [0, 2, 1, 2], [1, 2, 2, 1],
              [1, 3, 5, 2], [2, 3, 3, 3],
          ];
    const nodes = Math.max(2, Math.floor(typeof task.nodes === "number" ? task.nodes : 4));
    let low = 0;
    let high = 0;
    for (const edge of edges) {
        if (edge[3] !== 0) high = Math.max(high, edge[2] / edge[3]);
    }
    high = Math.max(1, high);
    const iterations = 16;
    let best: Tree | null = null;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(nodes, edges, new Set(), 0).entities,
        edges: makeEntities(nodes, edges, new Set(), 0).edges,
        description: `Searching for the spanning tree of minimum cost-to-weight ratio across ${nodes} vertices and ${edges.length} edges.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { nodes, answer: 0, bestEdges: [], lambda: 0, iterations: 0 },
    };
    step += 1;

    for (let i = 0; i < iterations; i += 1) {
        const lambda = (low + high) / 2;
        const tree = mstForLambda(edges, nodes, lambda);
        if (best === null || tree.ratio < best.ratio) best = tree;
        if (tree.adjusted > 0) low = lambda;
        else high = lambda;
        const picture = makeEntities(nodes, edges, new Set(tree.edges), lambda);
        yield {
            stepNumber: step,
            entities: picture.entities,
            edges: picture.edges,
            description: `Iteration ${i + 1}: lambda ${lambda.toFixed(4)} gives adjusted total ${tree.adjusted.toFixed(4)} and tree ratio ${tree.ratio.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: {
                nodes,
                answer: best.ratio,
                bestEdges: [...best.edges],
                lambda,
                iterations: i + 1,
                adjusted: tree.adjusted,
            },
        };
        step += 1;
    }

    const finalTree = mstForLambda(edges, nodes, high);
    if (best === null || finalTree.ratio < best.ratio) best = finalTree;
    const picture = makeEntities(nodes, edges, new Set(best.edges), high);
    yield {
        stepNumber: step,
        entities: picture.entities,
        edges: picture.edges,
        description: `Minimum ratio spanning tree has cost ${best.cost}, weight ${best.weight} and ratio ${best.ratio.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            nodes,
            answer: best.ratio,
            bestEdges: [...best.edges],
            cost: best.cost,
            weight: best.weight,
            lambda: high,
            iterations,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Comparing spanning trees by cost divided by weight is awkward, but subtracting lambda times the weight from every edge turns it into an ordinary minimum spanning tree problem. When the minimum adjusted total is positive, lambda is too small; when it is nonpositive, lambda is large enough. Binary search squeezes lambda to the exact ratio.",
        invariants: [
            "The minimum adjusted total is a nonincreasing function of lambda.",
            "A tree with adjusted total zero has ratio exactly lambda.",
            "The search brackets the optimal ratio between low and high throughout.",
        ],
        correctness:
            "For lambda below the optimal ratio every spanning tree has positive adjusted total, because the ratio-optimal tree itself has cost minus lambda times weight strictly greater than zero; hence the minimum adjusted total is positive. At the optimal ratio that tree has adjusted total zero, so the minimum is at most zero, and above it the minimum is negative. The predicate therefore separates the search range, and binary search converges to the optimal ratio. The tree attaining the smallest real ratio among evaluated lambdas is returned.",
        complexityRationale:
            "Each iteration sorts the edges for Kruskal, costing O(E log E), and there are a fixed number of iterations I, giving O(I * E log E) time. The parent array and chosen edges use O(V + E) space.",
        uses: [
            "Network design minimizing construction cost per unit capacity",
            "Selecting infrastructure under a benefit-to-cost objective",
            "Parametric search applied to classical MST",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, Chapter 23",
            "Ahuja, Magnanti and Orlin, Network Flows, Chapter 13 (fractional optimization)",
        ],
        workedExample:
            "On four vertices with edges 0-1 cost 4 weight 1, 0-2 cost 1 weight 2, 1-2 cost 2 weight 1, 1-3 cost 5 weight 2 and 2-3 cost 3 weight 3, the parametric search converges to the spanning tree whose total cost divided by total weight is smallest among the five possible trees.",
    },
    id: "minimum-ratio-spanning-tree",
    name: "Minimum Ratio Spanning Tree",
    category: "mst",
    complexity: { time: "O(I * E log E)", space: "O(V + E)" },
    defaultInput: {
        nodes: 4,
        edges: [
            [0, 1, 4, 1], [0, 2, 1, 2], [1, 2, 2, 1],
            [1, 3, 5, 2], [2, 3, 3, 3],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read the vertices and edges with a cost and a weight on each edge",
        "initialize the ratio bracket from zero to the largest edge cost per weight",
        "repeat a fixed number of binary search iterations",
        "set lambda to the midpoint of the bracket",
        "give every edge adjusted cost cost minus lambda times weight",
        "run Kruskal on adjusted costs to obtain a spanning tree",
        "if its adjusted total is positive raise the lower bound, else lower the upper bound",
        "report the spanning tree with the smallest true cost over weight ratio",
    ],
};

export default module;

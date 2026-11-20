/**
 * label-propagation-connected-components.ts - Connected Components via Label Propagation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Every vertex starts with its own id as a label. In each synchronous round a
 * vertex adopts the smallest label found among itself and its neighbors. After
 * a number of rounds equal to the graph's diameter, all vertices in a connected
 * component share the same label: the smallest vertex id in that component.
 * The update is local and uniform, so it maps naturally to parallel hardware.
 *
 * This deterministic model uses the minimum rule, which always converges. The
 * exact step shown is the final label of each vertex, checked against a direct
 * graph search: it equals the minimum id in that vertex's connected component.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(D * (n + m)) for diameter D, n vertices, and m edges
 *   Space: O(n + m) for the graph and the two label buffers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are nodes whose label is the current propagated label.
 *   - Edges inside a settled component are green; bridging edges are idle.
 *   - The final frame marks every converged vertex green.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

export interface LabelPropagationData {
    nodes: number;
    edges: number[][];
    rounds: number[][];
    finalLabels: number[];
    components: number[][];
}

/** Reference component assignment by union-find, used to verify convergence. */
function referenceComponents(n: number, edges: number[][]): number[][] {
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => {
        while (parent[x] !== x) {
            parent[x] = parent[parent[x]!]!;
            x = parent[x]!;
        }
        return x;
    };
    for (const [u, v] of edges) {
        if (u === undefined || v === undefined) {
            continue;
        }
        const a = find(u);
        const b = find(v);
        if (a !== b) {
            parent[b] = a;
        }
    }
    const groups = new Map<number, number[]>();
    for (let i = 0; i < n; i += 1) {
        const root = find(i);
        const group = groups.get(root) ?? [];
        group.push(i);
        groups.set(root, group);
    }
    return [...groups.values()];
}

/** Synchronous minimum label propagation with snapshot after each round. */
export function simulateLabelPropagation(n: number, edges: number[][]): LabelPropagationData {
    const size = Math.max(1, Math.floor(n));
    const neighbors = Array.from({ length: size }, () => [] as number[]);
    for (const [u, v] of edges) {
        if (u === undefined || v === undefined || u < 0 || v < 0 || u >= size || v >= size || u === v) {
            continue;
        }
        neighbors[u]!.push(v);
        neighbors[v]!.push(u);
    }
    let labels = Array.from({ length: size }, (_, i) => i);
    const rounds = [[...labels]];
    for (let iter = 0; iter < size; iter += 1) {
        const next = labels.map((label, i) =>
            neighbors[i]!.reduce((best, j) => Math.min(best, labels[j] ?? j), label),
        );
        rounds.push([...next]);
        if (next.every((label, i) => label === labels[i])) {
            labels = next;
            break;
        }
        labels = next;
    }
    const components = referenceComponents(size, edges);
    return { nodes: size, edges, rounds, finalLabels: labels, components };
}

/** Build vertex nodes for a label snapshot. */
function makeNodes(labels: number[], settled: boolean): VisualEntity[] {
    return labels.map((label, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: String(label),
        value: label,
        state: settled ? "sorted" as const : label === index ? "active" as const : "visited" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, label },
    }));
}

/** Build undirected edges, green when both ends share a label. */
function makeEdges(edges: number[][], labels: number[]): VisualEdge[] {
    return edges
        .filter(([u, v]) => u !== undefined && v !== undefined && u !== v)
        .map(([u, v], i) => ({
            id: `edge-${i}`,
            sourceId: `node-${u}`,
            targetId: `node-${v}`,
            label: "",
            state: labels[u] === labels[v] ? "sorted" as const : "idle" as const,
            directed: false,
        }));
}

/** The label propagation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { nodes?: number; edges?: number[][] } | null) ?? {};
    const nodes = typeof task.nodes === "number" ? Math.max(1, Math.floor(task.nodes)) : 8;
    const edges = Array.isArray(task.edges)
        ? task.edges
        : [[0, 1], [1, 2], [3, 4], [4, 5], [2, 5], [6, 7]];
    const data = simulateLabelPropagation(nodes, edges);

    for (let round = 0; round < data.rounds.length; round += 1) {
        const labels = data.rounds[round] ?? [];
        const settled = round === data.rounds.length - 1;
        const first = round === 0;
        yield {
            stepNumber: round,
            entities: makeNodes(labels, settled),
            edges: makeEdges(edges, labels),
            description: first
                ? `Start: ${nodes} vertices each carry their own id as a label.`
                : settled
                    ? `Converged after ${round - 1} round(s): each component shares its minimum vertex id.`
                    : `Round ${round}: every vertex adopts the smallest label among itself and its neighbors.`,
            codeLineNumber: first ? 0 : settled ? 5 : 2,
            layout: "graph",
            meta: {
                nodes,
                edges: data.edges.length,
                round: first ? 0 : round,
                labels: [...labels],
                components: data.components.map((c) => c.join(",")),
                converged: settled,
            },
        };
    }
}

/** The label propagation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Let each vertex whisper the smallest label it knows to its neighbors, all at once. After a few rounds the smallest id in a connected region has spread to every vertex in it, so vertices that can reach each other agree. No global map of the graph is needed; each step only looks at immediate neighbors.",
        invariants: [
            "Labels never increase, because a vertex only adopts a minimum.",
            "A label held by a vertex always belongs to that vertex's connected component.",
            "After enough rounds every vertex stores the minimum id of its component.",
        ],
        correctness:
            "By induction on the round number, after t rounds a vertex knows the minimum id among all vertices within graph distance t. Since the longest shortest path inside a component is at most n-1, after at most that many rounds the minimum of the whole component has reached every vertex. Vertices in different components never exchange labels, so their minima remain distinct. The final label is therefore exactly the minimum id of each connected component.",
        complexityRationale:
            "Each of the at most n rounds scans every vertex and its incident edges once, O(D*(n+m)) time where D is the diameter. Two label buffers of size n plus the adjacency list give O(n+m) space.",
        uses: [
            "Connected-component labeling in distributed graph processing",
            "Semi-supervised learning with label spreading",
            "Community detection and graph clustering baselines",
        ],
        references: [
            "Raghavan, Albert, and Kumara, Near Linear Time Algorithm to Detect Community Structures, 2007",
            "Karger and Stein, A New Approach to the Minimum Cut Problem, 1996 (contraction ideas)",
        ],
        workedExample:
            "On edges 0-1-2 and 3-4 with labels starting 0..4, round one gives [0,0,1,0,0] because vertex 2 learns label 1 from vertex 1 and vertex 4 learns label 3. A second round gives [0,0,0,0,0] for the first component and [3,3] for the second, matching the component minima 0 and 3.",
    },
    id: "label-propagation-connected-components",
    name: "Label Propagation Connected Components",
    category: "parallel-distributed",
    complexity: { time: "O(D*(n+m))", space: "O(n+m)" },
    defaultInput: { nodes: 8, edges: [[0, 1], [1, 2], [3, 4], [4, 5], [2, 5], [6, 7]] },
    visualType: "graph",
    run,
    pseudocode: [
        "give every vertex a label equal to its own id",
        "build the neighbor list from the undirected edges",
        "for each round until no label changes",
        "set each label to the smallest among self and neighbors",
        "read all labels from the previous round, not new ones",
        "stop when a full round leaves every label unchanged",
        "report the final label of every vertex",
        "done: equal labels identify one connected component",
    ],
};

export default module;

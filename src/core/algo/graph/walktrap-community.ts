/**
 * walktrap-community.ts - Walktrap Random-Walk Community Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Walktrap treats short random walks as a similarity signal: two vertices
 * belong to the same community when a random walk starting in either one is
 * likely to stay within the same region. Each vertex begins in its own
 * community. The algorithm repeatedly merges the pair whose average one-step
 * transition profiles are closest, recording the merge in a dendrogram, until
 * the requested number of communities remains.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for up to n merges with n vertices and profile scans
 *   Space: O(n^2) for the transition matrix and community profiles
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Nodes are tinted by their current community (path state marks the two
 *     communities selected for the next merge).
 *   - Edges are shown in idle state; the caption names the merged pair.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface Task {
    edges?: Array<[string, string, number?]>;
    targetCommunities?: number;
}

/** Average one-step landing distribution of a community. */
function profile(community: number[], transition: number[][]): number[] {
    const n = transition.length;
    const result = new Array<number>(n).fill(0);
    for (const u of community) {
        for (let v = 0; v < n; v += 1) result[v] = (result[v] ?? 0) + (transition[u]?.[v] ?? 0) / community.length;
    }
    return result;
}

/** Squared L2 distance between two average transition profiles. */
function profileDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        sum += diff * diff;
    }
    return sum;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const rawEdges = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges
        : ([
            ["A", "B", 1], ["A", "C", 1], ["B", "C", 1], ["C", "D", 1],
            ["D", "E", 1], ["E", "F", 1], ["F", "D", 1], ["G", "H", 1], ["G", "I", 1], ["H", "I", 1],
        ] as Array<[string, string, number?]>);
    const cleanEdges: Array<[string, string, number]> = rawEdges
        .filter((e) => Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "string")
        .map(([a, b, w]) => [a, b, typeof w === "number" && w > 0 ? w : 1]);
    const vertices = [...new Set(cleanEdges.flatMap(([a, b]) => [a, b]))].sort();
    const n = vertices.length;
    const index = new Map(vertices.map((label, i) => [label, i]));
    const target = Math.max(1, Math.min(n, Math.floor(Number(task.targetCommunities ?? 2)) || 2));

    const weight = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (const [a, b, w] of cleanEdges) {
        const u = index.get(a);
        const v = index.get(b);
        if (u === undefined || v === undefined || u === v) continue;
        weight[u]![v] = (weight[u]![v] ?? 0) + w;
        weight[v]![u] = (weight[v]![u] ?? 0) + w;
    }
    const transition = weight.map((row) => {
        const total = row.reduce((s, x) => s + x, 0);
        return total > 0 ? row.map((x) => x / total) : row.map(() => 0);
    });

    const edges: VisualEdge[] = cleanEdges
        .filter(([a, b]) => a !== b)
        .map(([a, b]) => ({
            id: `edge-${a}-${b}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: "idle" as const,
            directed: false,
        }));

    let communities: number[][] = vertices.map((_, i) => [i]);
    let membership: number[] = vertices.map((_, i) => i);
    let lastDistance = 0;
    let mergeCount = 0;
    let selected: [number, number] = [-1, -1];

    const frame = (description: string, codeLine: number, phase: string): VisualFrame => {
        const nodes: VisualEntity[] = makeGraphNodes(vertices).map((node, i) => {
            const group = membership[i] ?? 0;
            let state: EntityState = "visited";
            if (selected[0] === group || selected[1] === group) state = "path";
            node.state = state;
            node.label = `${vertices[i]}:C${group}`;
            node.metadata = { ...node.metadata, community: group };
            return node;
        });
        return {
            stepNumber: 0,
            entities: nodes,
            edges: edges.map((e) => ({ ...e })),
            description,
            codeLineNumber: codeLine,
            layout: "graph",
            meta: {
                phase,
                labels: vertices,
                communities: communities.map((c) => c.map((i) => vertices[i]).join(",")),
                membership: [...membership],
                mergeCount,
                lastDistance,
                communityCount: communities.length,
            },
        };
    };

    let step = 0;
    const first = frame(`Start with ${n} singleton communities; target ${target}.`, 0, "setup");
    first.stepNumber = step;
    step += 1;
    yield first;

    while (communities.length > target) {
        const profiles = communities.map((c) => profile(c, transition));
        let bestI = -1;
        let bestJ = -1;
        let bestDistance = Infinity;
        for (let i = 0; i < communities.length; i += 1) {
            for (let j = i + 1; j < communities.length; j += 1) {
                const distance = profileDistance(profiles[i] ?? [], profiles[j] ?? []);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestI = i;
                    bestJ = j;
                }
            }
        }
        if (bestI < 0 || bestJ < 0) break;

        selected = [bestI, bestJ];
        lastDistance = bestDistance;
        const before = frame(
            `Closest profiles: C${bestI} and C${bestJ}, distance ${bestDistance.toFixed(5)}.`,
            2,
            "select",
        );
        before.stepNumber = step;
        step += 1;
        yield before;

        const merged = [...(communities[bestI] ?? []), ...(communities[bestJ] ?? [])].sort((a, b) => a - b);
        communities = communities.filter((_, k) => k !== bestI && k !== bestJ);
        communities.push(merged);
        const newIndex = communities.length - 1;
        for (const member of merged) membership[member] = newIndex;
        // Renumber communities by their smallest member for a stable display.
        const order = communities
            .map((c, k) => ({ c, k }))
            .sort((a, b) => (a.c[0] ?? 0) - (b.c[0] ?? 0));
        const remap = new Map<number, number>();
        order.forEach(({ k }, newK) => remap.set(k, newK));
        communities = order.map(({ c }) => c);
        membership = membership.map((g) => remap.get(g) ?? g);
        mergeCount += 1;
        selected = [-1, -1];

        const after = frame(`Merged C${bestI} and C${bestJ} into one community (${merged.length} vertices).`, 4, "merge");
        after.stepNumber = step;
        step += 1;
        yield after;
    }

    const final = frame(
        `Walktrap finished with ${communities.length} communities after ${mergeCount} merge(s).`,
        6,
        "done",
    );
    final.stepNumber = step;
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A random walk tends to get trapped inside a tightly knit group of vertices, so two groups whose walks land on similar vertices are probably the same community. Starting with every vertex alone, the algorithm repeatedly fuses the two groups whose average one-step landing distributions are closest. The sequence of fusions forms a hierarchy that can be cut at any desired number of communities.",
        invariants: [
            "Every vertex belongs to exactly one community at all times.",
            "The number of communities decreases by one with each merge.",
            "Transition profiles are row-stochastic: their entries sum to one.",
        ],
        correctness:
            "The merge rule is a Ward-style greedy step on the squared distance between average one-step transition profiles, so it always joins the two most similar groups available. By induction each community is a union of original vertices and the partition remains a cover of the vertex set. The final partition is the cut of the recorded hierarchy at the requested level; the algorithm is a heuristic rather than an exact optimizer of a global objective, which is the expected behavior for community detection.",
        complexityRationale:
            "Each of the at most n-1 merges evaluates O(m^2) profile distances over m communities, each distance costing O(n), giving O(n^3) time in the worst case. The transition matrix and per-community profiles use O(n^2) space.",
        uses: [
            "Finding modules in social and collaboration networks",
            "Grouping related documents by link structure",
            "Preprocessing for hierarchical network visualization",
        ],
        references: [
            "Pons and Latapy, Computing Communities in Large Networks Using Random Walks, 2005",
            "Fortunato, Community Detection in Graphs, Physics Reports, 2010",
        ],
        workedExample:
            "On two triangles joined by a single bridge, each vertex starts alone. Vertices inside a triangle have transition profiles concentrated on their two triangle neighbors, so those pairs merge first. After the two triangles have formed, their profiles differ mainly at the bridge endpoints, so they are merged last when the target is one community.",
    },
    id: "walktrap-community",
    name: "Walktrap Community Detection",
    category: "graph",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        edges: [
            ["A", "B", 1], ["A", "C", 1], ["B", "C", 1], ["C", "D", 1],
            ["D", "E", 1], ["E", "F", 1], ["F", "D", 1], ["G", "H", 1], ["G", "I", 1], ["H", "I", 1],
        ],
        targetCommunities: 2,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the weighted adjacency and one-step transition matrix",
        "place every vertex in its own community",
        "compute each community's average transition profile",
        "find the pair of communities with the smallest profile distance",
        "merge that pair into a single community",
        "update membership and repeat while too many communities remain",
        "record the final partition of vertices into communities",
        "done: report the communities and the merge count",
    ],
};

export default module;

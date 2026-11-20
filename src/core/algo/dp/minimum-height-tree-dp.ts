/**
 * minimum-height-tree-dp.ts - Minimum Height Tree (Leaf Peeling DP)
 *
 * Finds every root of an unweighted tree that minimizes the height of the
 * rooted tree. Repeatedly stripping the current leaves leaves one or two
 * central vertices; those are exactly the roots of minimum height.
 *
 * Time: O(n). Space: O(n) for adjacency, degree counts and the leaf queue.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualEdge, VisualFrame } from "@/types";

type Edge = [number, number];

function build(nodes: number[], edges: Edge[]) {
    const adjacency = new Map<number, number[]>();
    for (const n of nodes) adjacency.set(n, []);
    for (const [u, v] of edges) {
        adjacency.get(u)?.push(v);
        adjacency.get(v)?.push(u);
    }
    return adjacency;
}

/** Root at the lowest node so the tree layout can draw real parent links. */
function parentMap(nodes: number[], adjacency: Map<number, number[]>): Map<number, number> {
    const root = nodes[0] ?? 0;
    const parents = new Map<number, number>();
    const queue = [root];
    parents.set(root, -1);
    while (queue.length > 0) {
        const u = queue.shift();
        if (u === undefined) continue;
        for (const v of adjacency.get(u) ?? []) {
            if (!parents.has(v)) {
                parents.set(v, u);
                queue.push(v);
            }
        }
    }
    return parents;
}

function heightFrom(root: number, adjacency: Map<number, number[]>): number {
    const distance = new Map<number, number>([[root, 0]]);
    const queue = [root];
    let best = 0;
    while (queue.length > 0) {
        const u = queue.shift();
        if (u === undefined) continue;
        for (const v of adjacency.get(u) ?? []) {
            if (!distance.has(v)) {
                const d = (distance.get(u) ?? 0) + 1;
                distance.set(v, d);
                best = Math.max(best, d);
                queue.push(v);
            }
        }
    }
    return best;
}

function makeEntities(
    nodes: number[],
    edges: Edge[],
    parents: Map<number, number>,
    present: Set<number>,
    removing: Set<number>,
    centers: Set<number>,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = nodes.map((n) => {
        let state: EntityState = "idle";
        if (centers.has(n)) state = "sorted";
        else if (removing.has(n)) state = "swapped";
        else if (present.has(n)) state = "active";
        const parent = parents.get(n) ?? -1;
        return {
            id: `node-${n}`,
            type: "node" as const,
            label: String(n),
            value: n,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { node: n, parentId: parent >= 0 ? `node-${parent}` : -1 },
        };
    });
    const visualEdges: VisualEdge[] = edges.map(([u, v]) => ({
        id: `edge-${u}-${v}`,
        sourceId: `node-${u}`,
        targetId: `node-${v}`,
        label: "",
        state: centers.has(u) && centers.has(v) ? "path" : "idle",
        directed: false,
    }));
    return { entities, edges: visualEdges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { edges?: Edge[] } | null) ?? {};
    const edges: Edge[] = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges.map((e) => [Number(e[0]), Number(e[1])] as Edge)
        : [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
    const nodes: number[] = [];
    for (const [u, v] of edges) {
        if (!nodes.includes(u)) nodes.push(u);
        if (!nodes.includes(v)) nodes.push(v);
    }
    if (nodes.length === 0) nodes.push(0);
    const adjacency = build(nodes, edges);
    const parents = parentMap(nodes, adjacency);
    const degree = new Map<number, number>();
    for (const n of nodes) degree.set(n, (adjacency.get(n) ?? []).length);
    const present = new Set(nodes);
    let leaves = nodes.filter((n) => (degree.get(n) ?? 0) <= 1);
    let step = 0;

    const initial = makeEntities(nodes, edges, parents, present, new Set(), new Set());
    yield {
        stepNumber: step,
        entities: initial.entities,
        edges: initial.edges,
        description: `Stripping leaves of a ${nodes.length}-node tree until one or two centers remain.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { centers: [], answer: 0, rounds: 0 },
    };
    step += 1;

    let rounds = 0;
    while (present.size > 2 && leaves.length > 0) {
        const removing = new Set(leaves);
        const picture = makeEntities(nodes, edges, parents, present, removing, new Set());
        yield {
            stepNumber: step,
            entities: picture.entities,
            edges: picture.edges,
            description: `Round ${rounds + 1}: remove ${leaves.length} leaf node(s) [${leaves.join(", ")}] and decrement their neighbors.`,
            codeLineNumber: 3,
            layout: "tree",
            meta: { centers: [], answer: 0, rounds: rounds + 1, removed: [...leaves] },
        };
        step += 1;
        for (const leaf of leaves) present.delete(leaf);
        const nextLeaves: number[] = [];
        for (const leaf of leaves) {
            for (const neighbor of adjacency.get(leaf) ?? []) {
                if (!present.has(neighbor)) continue;
                degree.set(neighbor, (degree.get(neighbor) ?? 0) - 1);
                if ((degree.get(neighbor) ?? 0) <= 1 && !nextLeaves.includes(neighbor)) nextLeaves.push(neighbor);
            }
        }
        leaves = nextLeaves;
        rounds += 1;
    }

    const centers = [...present].sort((a, b) => a - b);
    const heights = centers.map((c) => heightFrom(c, adjacency));
    const answer = heights.length > 0 ? Math.min(...heights) : 0;
    const final = makeEntities(nodes, edges, parents, present, new Set(), new Set(centers));
    yield {
        stepNumber: step,
        entities: final.entities,
        edges: final.edges,
        description: `Centers [${centers.join(", ")}] are the minimum-height roots; the resulting height is ${answer}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { centers, answer, rounds, heights },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rooting a tree at a leaf makes it tall, so the best roots sit near the middle. If you repeatedly delete all current leaves, the vertices that survive longest are the middle of the tree. After stripping layers, one or two vertices remain, and those are precisely the roots of minimum height.",
        invariants: [
            "Every removed vertex is a leaf of the tree induced by the remaining vertices.",
            "Deleting a layer reduces the eccentricity of every surviving vertex by exactly one.",
            "The surviving set is always connected and nonempty.",
        ],
        correctness:
            "The eccentricity of a vertex is one plus the maximum eccentricity among its remaining neighbors after the outer layer is removed. Peeling all leaves simultaneously lowers every surviving eccentricity by one, so the ordering of eccentricities is preserved. When one or two vertices remain they minimize eccentricity, which is exactly the height when the tree is rooted there; if two remain they are adjacent and share the same minimum height.",
        complexityRationale:
            "Each vertex enters the leaf list once and each edge is examined when its endpoint is removed, so the peeling takes O(n) time. Adjacency lists, degrees and the present set use O(n) space.",
        uses: [
            "Choosing an optimal root for hierarchical tree layouts",
            "Locating central nodes in communication and sensor networks",
            "A linear-time alternative to checking every root by BFS",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 1, section 2.3.4.3",
            "Cormen et al., Introduction to Algorithms, Chapter 22 (BFS)",
        ],
        workedExample:
            "For the tree with edges 0-1, 0-2, 1-3, 1-4, 2-5, 2-6, the first round removes leaves 3, 4, 5, 6, leaving a path 1-0-2. The next round removes 1 and 2, so only center 0 remains and the minimum height is two.",
    },
    id: "minimum-height-tree-dp",
    name: "Minimum Height Tree (Leaf Peeling)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { edges: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]] },
    visualType: "tree",
    run,
    pseudocode: [
        "build adjacency lists and initialize every vertex degree",
        "place all leaves, vertices of degree at most one, in a list",
        "while more than two vertices remain",
        "remove the current leaves from the remaining tree",
        "decrement neighbor degrees and collect newly exposed leaves",
        "the remaining one or two vertices are the minimum-height centers",
        "report the centers and the height of the rooted tree",
    ],
};

export default module;

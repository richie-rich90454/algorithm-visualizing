/**
 * tree-median.ts - Tree Median (Minimum Total Distance)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The median of a tree is the vertex whose total distance to all other
 * vertices is smallest. A first traversal computes subtree sizes and the total
 * distance from an arbitrary root. A second traversal moves the root across
 * each edge: shifting the root from u to a child with subtree size s changes
 * the total by (n - 2s). The minimum over all rerooted totals is the median.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) - two traversals of the tree
 *   Space: O(n) for adjacency, subtree sizes, and totals
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are circles laid out by the tree layout.
 *   - A node during the size pass is YELLOW (comparing).
 *   - A node during the reroot pass is ACTIVE (active).
 *   - The median vertex is GREEN (sorted) on the final frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualEdge, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

type Task = { parentMap?: Record<string, string | null>; ids?: string[] };

const DEFAULT_PARENTS: Record<string, string | null> = {
    A: null,
    B: "A",
    C: "A",
    D: "B",
    E: "B",
    F: "C",
    G: "C",
};

function buildEntities(
    parentMap: Map<string, string | null>,
    ids: string[],
    states: Map<string, EntityState>,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities = makeTreeNodes(parentMap, ids).map((node) => ({
        ...node,
        state: states.get(node.id) ?? ("unvisited" as EntityState),
    }));
    return { entities, edges: makeTreeEdges(parentMap, ids) };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const parentMap = new Map<string, string | null>(Object.entries(task.parentMap ?? DEFAULT_PARENTS));
    const ids = task.ids ?? Object.keys(DEFAULT_PARENTS);
    const n = ids.length;
    let step = 0;

    const root = ids.find((id) => {
        const parent = parentMap.get(id);
        return parent === null || parent === undefined || !ids.includes(parent);
    }) ?? ids[0];

    const children = new Map<string, string[]>();
    for (const id of ids) {
        children.set(id, []);
    }
    for (const id of ids) {
        const parent = parentMap.get(id);
        if (parent && parent !== id && ids.includes(parent)) {
            children.get(parent)?.push(id);
        }
    }

    yield {
        stepNumber: step,
        ...buildEntities(parentMap, ids, new Map()),
        description: `Finding the vertex of "${ids.join("-")}" with the smallest total distance to all others.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { nodeCount: n, phase: "setup" },
    };
    step += 1;

    if (n === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "An empty tree has no median vertex.",
            codeLineNumber: 9,
            layout: "tree",
            meta: { median: "", totalDistance: 0, nodeCount: 0 },
        };
        return;
    }

    const subtreeSize = new Map<string, number>();
    const total = new Map<string, number>();

    // First pass: postorder subtree sizes and root total distance.
    const visit = (node: string): number => {
        let size = 1;
        let sum = 0;
        for (const child of children.get(node) ?? []) {
            const childSize = visit(child);
            size += childSize;
            sum += (total.get(child) ?? 0) + childSize;
        }
        subtreeSize.set(node, size);
        total.set(node, sum);
        return size;
    };
    visit(root as string);

    const order: string[] = [];
    const collect = (node: string): void => {
        order.push(node);
        for (const child of children.get(node) ?? []) {
            collect(child);
        }
    };
    collect(root as string);

    for (const node of order) {
        const states = new Map<string, EntityState>([[`node-${node}`, "comparing"]]);
        yield {
            stepNumber: step,
            ...buildEntities(parentMap, ids, states),
            description: `Size pass at ${node}: subtree size ${subtreeSize.get(node)}, distance total ${total.get(node)} from the root.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { node, subtreeSize: subtreeSize.get(node) ?? 0, rootDistance: total.get(node) ?? 0, phase: "sizes" },
        };
        step += 1;
    }

    // Second pass: move the root across each edge and update the total.
    const pending: Array<{ child: string; moved: number }> = [];
    const reroot = (node: string): void => {
        for (const child of children.get(node) ?? []) {
            const s = subtreeSize.get(child) ?? 0;
            const moved = (total.get(node) ?? 0) + n - 2 * s;
            total.set(child, moved);
            pending.push({ child, moved });
            reroot(child);
        }
    };
    reroot(root as string);

    for (const item of pending) {
        const states = new Map<string, EntityState>([[`node-${item.child}`, "active"]]);
        yield {
            stepNumber: step,
            ...buildEntities(parentMap, ids, states),
            description: `Reroot to ${item.child}: total distance becomes ${item.moved} by adding (n - 2s).`,
            codeLineNumber: 5,
            layout: "tree",
            meta: { node: item.child, totalDistance: item.moved, phase: "reroot" },
        };
        step += 1;
    }

    let median = ids[0] as string;
    let best = total.get(median) ?? Infinity;
    for (const id of ids) {
        const value = total.get(id) ?? Infinity;
        if (value < best) {
            best = value;
            median = id;
        }
    }

    const finalStates = new Map<string, EntityState>([[`node-${median}`, "sorted"]]);
    yield {
        stepNumber: step,
        ...buildEntities(parentMap, ids, finalStates),
        description: `Done: median is ${median} with total distance ${best} to all other vertices.`,
        codeLineNumber: 9,
        layout: "tree",
        meta: { median, totalDistance: best, nodeCount: n, phase: "done" },
    };
}

/** The Tree Median module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The spot that minimizes the sum of distances to everyone is a tree's version of a meeting point. If you stand at a vertex and look at a child's whole subtree of size s, moving across that edge makes s vertices one step closer and the other n minus s vertices one step farther. That gives a constant-time update for each new root.",
        invariants: [
            "subtreeSize[v] counts the vertices below v in the first rooted traversal.",
            "total[root] is the sum of distances from the root to every vertex.",
            "After rerooting across an edge to a subtree of size s, the new total is the old total plus n minus 2s.",
        ],
        correctness:
            "The first pass computes subtree sizes and the root's true distance sum by summing child contributions. The reroot formula is exact because crossing an edge changes the distance to each vertex in the child subtree by minus one and to every other vertex by plus one. Visiting every vertex with this update therefore yields the true total distance for each, and choosing the smallest gives the tree median.",
        complexityRationale:
            "Each of the two depth-first traversals visits every vertex and edge once, so time is O(n). Adjacency lists, subtree sizes, and totals each store one entry per vertex, giving O(n) space.",
        uses: [
            "Choosing an optimal facility or meeting location on a tree network",
            "Placing a root to minimize total routing cost in a tree topology",
            "Computing the 1-median as a step in tree facility location",
        ],
        references: [
            "CLRS, Introduction to Algorithms, Chapter 22 on elementary graph algorithms",
            "Ahuja, Magnanti and Orlin, Network Flows, chapter on tree location problems",
        ],
        workedExample:
            "For a path A-B-C-D, the totals are A=6, B=4, C=4, D=6. Both B and C are medians with total distance 4; scanning in input order reports B.",
    },
    id: "tree-median",
    name: "Tree Median",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        parentMap: { A: null, B: "A", C: "A", D: "B", E: "B", F: "C", G: "C" },
        ids: ["A", "B", "C", "D", "E", "F", "G"],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "build adjacency lists from the parent pointers",
        "root the tree at any vertex",
        "postorder: compute subtree sizes and the root distance total",
        "record the subtree size and total for each vertex",
        "for each child of a vertex move the root across that edge",
        "set child total to parent total plus n minus twice the subtree size",
        "continue until every vertex has a rerooted total",
        "scan all totals and keep the smallest",
        "record the vertex that minimizes the total distance",
        "done: report the median vertex and its total distance",
    ],
};

export default module;

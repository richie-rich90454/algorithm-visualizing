/**
 * subtree-size-dp.ts - Subtree Size Dynamic Programming
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Computes, for every vertex of a rooted tree, how many vertices lie in its
 * subtree including itself. A depth-first walk visits each vertex, and on the
 * way back up each parent adds the sizes of its children to its own count of
 * one. These sizes are the foundation of rerooting, k-th order statistics on
 * trees, and many other tree algorithms.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) - each vertex and edge is processed once
 *   Space: O(n) for adjacency, sizes, and the traversal stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are circles arranged by the tree layout.
 *   - A node during the downward visit is YELLOW (comparing).
 *   - A node whose size is finalized is GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

type Task = { parentMap?: Record<string, string | null>; ids?: string[] };

const DEFAULT_PARENTS: Record<string, string | null> = {
    A: null,
    B: "A",
    C: "A",
    D: "B",
    E: "B",
    F: "C",
    G: "F",
};

function build(
    parentMap: Map<string, string | null>,
    ids: string[],
    states: Map<string, EntityState>,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    return {
        entities: makeTreeNodes(parentMap, ids).map((n) => ({ ...n, state: states.get(n.id) ?? "unvisited" })),
        edges: makeTreeEdges(parentMap, ids),
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const parentMap = new Map<string, string | null>(Object.entries(task.parentMap ?? DEFAULT_PARENTS));
    const ids = task.ids ?? Object.keys(DEFAULT_PARENTS);
    const n = ids.length;
    let step = 0;

    yield {
        stepNumber: step,
        ...build(parentMap, ids, new Map()),
        description: `Computing subtree sizes for the rooted tree on "${ids.join("-")}".`,
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
            description: "An empty tree has no subtree sizes to compute.",
            codeLineNumber: 7,
            layout: "tree",
            meta: { nodes: [], sizes: [], nodeCount: 0 },
        };
        return;
    }

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
    const root = ids.find((id) => {
        const parent = parentMap.get(id);
        return parent === null || parent === undefined || !ids.includes(parent);
    }) ?? ids[0];

    const sizes = new Map<string, number>();
    const stack: Array<{ node: string; expanded: boolean }> = [{ node: root as string, expanded: false }];

    while (stack.length > 0) {
        const frame = stack.pop() as { node: string; expanded: boolean };
        if (!frame.expanded) {
            stack.push({ node: frame.node, expanded: true });
            for (const child of children.get(frame.node) ?? []) {
                stack.push({ node: child, expanded: false });
            }
            yield {
                stepNumber: step,
                ...build(parentMap, ids, new Map([[`node-${frame.node}`, "comparing"]])),
                description: `Descending into ${frame.node} to visit its ${(children.get(frame.node) ?? []).length} child subtree(s).`,
                codeLineNumber: 2,
                layout: "tree",
                meta: { node: frame.node, phase: "descend", nodeCount: n },
            };
            step += 1;
        } else {
            let total = 1;
            for (const child of children.get(frame.node) ?? []) {
                total += sizes.get(child) ?? 0;
            }
            sizes.set(frame.node, total);
            yield {
                stepNumber: step,
                ...build(parentMap, ids, new Map([[`node-${frame.node}`, "sorted"]])),
                description: `Subtree of ${frame.node} has size ${total}, including its children's sizes.`,
                codeLineNumber: 4,
                layout: "tree",
                meta: { node: frame.node, subtreeSize: total, phase: "sizes" },
            };
            step += 1;
        }
    }

    const orderedNodes: string[] = [];
    const orderedSizes: number[] = [];
    for (const id of ids) {
        orderedNodes.push(id);
        orderedSizes.push(sizes.get(id) ?? 0);
    }
    const finalStates = new Map<string, EntityState>();
    for (const id of ids) {
        finalStates.set(`node-${id}`, "sorted");
    }
    yield {
        stepNumber: step,
        ...build(parentMap, ids, finalStates),
        description: `Done: subtree sizes are [${orderedSizes.join(", ")}].`,
        codeLineNumber: 7,
        layout: "tree",
        meta: { nodes: orderedNodes, sizes: orderedSizes, nodeCount: n, phase: "done" },
    };
}

/** The Subtree Size Dynamic Programming module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A subtree's size is one for the node itself plus the sizes of all its child subtrees. Walk down the tree first, then add the answers back on the way up. This two-phase depth-first pattern is the simplest example of tree dynamic programming.",
        invariants: [
            "A node's size is finalized only after every child's size is known.",
            "The size of a leaf is always one.",
            "The root's size equals the number of vertices in the whole tree.",
        ],
        correctness:
            "The postorder schedule guarantees that all children of a node are finalized before the node. Adding one plus each child's size counts every descendant exactly once, because the child subtrees are disjoint and together with the node they form its subtree. By induction every stored size is correct.",
        complexityRationale:
            "The iterative traversal pushes each vertex once on the way down and once on the way up, so time is O(n). The adjacency lists, size map, and stack each hold O(n) entries.",
        uses: [
            "Answering subtree cardinality queries in rooted hierarchies",
            "Preprocessing for rerooting and k-th smallest path queries",
            "Computing file or directory sizes in a tree of folders",
        ],
        references: [
            "CLRS, Introduction to Algorithms, Chapter 22 on depth-first search",
            "cp-algorithms.com, LCA and tree dynamic programming articles",
        ],
        workedExample:
            'With root A and children B and C, where B has children D and E, the leaves D and E get size 1, B becomes 3, C stays 1, and A becomes 5.',
    },
    id: "subtree-size-dp",
    name: "Subtree Size DP",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        parentMap: { A: null, B: "A", C: "A", D: "B", E: "B", F: "C", G: "F" },
        ids: ["A", "B", "C", "D", "E", "F", "G"],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "build child lists from the parent pointers",
        "find the root with no parent",
        "push the root onto a traversal stack",
        "pop a node and descend into each child",
        "after all children are done set size to one plus child sizes",
        "continue until the stack is empty",
        "verify that the root size equals the vertex count",
        "done: report every node with its subtree size",
    ],
};

export default module;

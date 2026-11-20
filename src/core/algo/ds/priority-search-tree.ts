/**
 * priority-search-tree.ts - Priority Search Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A priority search tree stores two-dimensional points so that a three-sided
 * query "x in [xlo, xhi] and y at least ytho" is answered in O(log n + k)
 * time, where k is the number of reported points. The structure is a binary
 * search tree on x and a max heap on y at the same time: every node has a
 * larger y than its children, and every left descendant has a smaller x while
 * every right descendant has a larger x.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * Keys are pairs (x, index) so that duplicate x values remain distinct. The
 * heap priority is the pair (y, index). This is the classic McCreight
 * construction specialized to a static set of points; no dynamic updates,
 * external memory, or parallelism are modeled.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Build:  O(n log n) insertions
 *   Query:  O(log n + k) reported points
 *   Space:  O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Tree nodes show the stored (x, y) points.
 *   - Nodes visited by the query are highlighted along the search path.
 *   - Reported points turn green in the final frame.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

interface PNode {
    id: string;
    x: number;
    y: number;
    idx: number;
    left: PNode | null;
    right: PNode | null;
}

const keyLess = (a: PNode, b: PNode): boolean => a.x < b.x || (a.x === b.x && a.idx < b.idx);
const prioGreater = (a: PNode, b: PNode): boolean => a.y > b.y || (a.y === b.y && a.idx > b.idx);

function rotateLeft(node: PNode): PNode {
    const pivot = node.right;
    if (!pivot) {
        return node;
    }
    node.right = pivot.left;
    pivot.left = node;
    return pivot;
}

function rotateRight(node: PNode): PNode {
    const pivot = node.left;
    if (!pivot) {
        return node;
    }
    node.left = pivot.right;
    pivot.right = node;
    return pivot;
}

function insert(root: PNode | null, node: PNode): PNode {
    if (!root) {
        return node;
    }
    if (keyLess(node, root)) {
        root.left = insert(root.left, node);
        if (root.left && prioGreater(root.left, root)) {
            return rotateRight(root);
        }
    } else {
        root.right = insert(root.right, node);
        if (root.right && prioGreater(root.right, root)) {
            return rotateLeft(root);
        }
    }
    return root;
}

function collect(root: PNode | null, states: Map<string, string>): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const nodes: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const walk = (node: PNode, parentId: string | null): void => {
        nodes.push({
            id: node.id,
            type: "node" as const,
            label: `(${node.x},${node.y})`,
            value: { x: node.x, y: node.y },
            state: (states.get(node.id) ?? "unvisited") as VisualEntity["state"],
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                px: node.x,
                py: node.y,
                ...(parentId === null ? {} : { parentId }),
            },
        });
        for (const child of [node.left, node.right]) {
            if (child) {
                edges.push({
                    id: `edge-${node.id}-${child.id}`,
                    sourceId: node.id,
                    targetId: child.id,
                    label: "",
                    state: "idle" as const,
                    directed: false,
                });
                walk(child, node.id);
            }
        }
    };
    if (root) {
        walk(root, null);
    }
    return { nodes, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[]; xlo?: number; xhi?: number; ytho?: number } | null) ?? {};
    const points: Point[] = task.points ?? [
        [5, 9],
        [2, 7],
        [8, 6],
        [1, 3],
        [4, 8],
        [7, 2],
        [3, 5],
        [6, 4],
    ];
    const xlo = typeof task.xlo === "number" ? task.xlo : 2;
    const xhi = typeof task.xhi === "number" ? task.xhi : 6;
    const ytho = typeof task.ytho === "number" ? task.ytho : 5;

    let root: PNode | null = null;
    points.forEach((point, idx) => {
        const node: PNode = {
            id: `node-${idx}`,
            x: point[0] ?? 0,
            y: point[1] ?? 0,
            idx,
            left: null,
            right: null,
        };
        root = insert(root, node);
    });

    const initial = collect(root, new Map());
    let step = 0;
    yield {
        stepNumber: step,
        entities: initial.nodes,
        edges: initial.edges,
        description: `Built a priority search tree over ${points.length} points; x is the search key and y is the heap priority.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { xlo, xhi, ytho, points: points.length },
    };
    step += 1;

    const visited: string[] = [];
    const reported: string[] = [];
    const visit = (node: PNode | null): void => {
        if (!node) {
            return;
        }
        visited.push(node.id);
        if (node.y < ytho) {
            return;
        }
        if (node.x < xlo) {
            visit(node.right);
        } else if (node.x > xhi) {
            visit(node.left);
        } else {
            reported.push(node.id);
            visit(node.left);
            visit(node.right);
        }
    };
    visit(root);

    for (let i = 0; i < visited.length; i += 1) {
        const current = visited[i];
        const states = new Map<string, string>();
        for (let j = 0; j <= i; j += 1) {
            states.set(visited[j] ?? "", j === i ? "comparing" : "path");
        }
        const frame = collect(root, states);
        yield {
            stepNumber: step,
            entities: frame.nodes,
            edges: frame.edges,
            description: `Visiting node ${current} at query step ${i + 1}; the y threshold and x key decide which branches are searched.`,
            codeLineNumber: i === visited.length - 1 ? 4 : 3,
            layout: "tree",
            meta: { xlo, xhi, ytho, visiting: current, visitedCount: i + 1 },
        };
        step += 1;
    }

    const finalStates = new Map<string, string>();
    for (const id of reported) {
        finalStates.set(id, "sorted");
    }
    const final = collect(root, finalStates);
    const result = reported.map((id) => {
        const idx = Number(id.slice(5));
        return [points[idx]?.[0] ?? 0, points[idx]?.[1] ?? 0] as Point;
    });
    yield {
        stepNumber: step,
        entities: final.nodes,
        edges: final.edges,
        description: `Three-sided query returns ${result.length} point(s) with x in [${xlo}, ${xhi}] and y at least ${ytho}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: {
            xlo,
            xhi,
            ytho,
            result: result.flat(),
            resultCount: result.length,
            visited: [...visited],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Store points in a tree that is simultaneously ordered left to right by x and stacked by y. Because a parent always dominates its children in y, once a node's y falls below the threshold none of its descendants can qualify. That single fact lets a three-sided query ignore whole subtrees.",
        invariants: [
            "Every node has a larger y than each child, so y decreases along any root to leaf path.",
            "Every left descendant has a smaller search key and every right descendant a larger one.",
            "A node whose y is below the threshold has no descendant that meets the threshold.",
        ],
        correctness:
            "Insertion uses treap rotations with the search key on x and priority on y, preserving both the binary search tree order and the max heap order at every rotation. The query visits only a subtree when its root can contain qualifying points: a node below the y threshold prunes its whole subtree by the heap invariant, a node left of the range skips its left subtree by the x order, and a node right of the range skips its right subtree. Every reported point lies in range, and any qualifying point lies on a visited branch, so the answer is exact.",
        complexityRationale:
            "Insertion follows a root to leaf path and rotates at most once per level, so building n points costs O(n log n) expected time and O(n) space. A query visits the search path plus the k reported nodes and their pruned siblings, giving O(log n + k).",
        uses: [
            "Geographic information systems answering rectangular range queries",
            "Database indexes for three-sided spatial predicates",
            "Collision detection over a set of moving points",
        ],
        references: [
            "McCreight, Priority Search Trees (1985)",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 10",
        ],
        workedExample:
            "For points (5,9), (2,7), (8,6), (1,3), (4,8), (7,2), (3,5), (6,4) and the query x in [2,6] with y at least 5, the root (5,9) qualifies, the branch to (2,7) qualifies, (4,8) and (3,5) qualify, while (1,3) and (7,2) are pruned because their y is below the threshold. The answer is (5,9), (2,7), (4,8), (3,5).",
    },
    id: "priority-search-tree",
    name: "Priority Search Tree",
    category: "data-structures",
    complexity: { time: "O(log n + k) query", space: "O(n)" },
    defaultInput: {
        points: [
            [5, 9],
            [2, 7],
            [8, 6],
            [1, 3],
            [4, 8],
            [7, 2],
            [3, 5],
            [6, 4],
        ],
        xlo: 2,
        xhi: 6,
        ytho: 5,
    },
    visualType: "tree",
    run,
    pseudocode: [
        "build a binary search tree on x that is a max heap on y",
        "start at the root with the query range and threshold",
        "if the node y is below the threshold stop on this branch",
        "if the node x is left of the range continue only to the right",
        "if the node x is right of the range continue only to the left",
        "otherwise report the node and recurse into both children",
        "collect the reported points as the query answer",
    ],
};

export default module;

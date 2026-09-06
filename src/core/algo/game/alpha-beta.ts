/**
 * alpha-beta.ts – Alpha-Beta Pruning
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Alpha-beta pruning is minimax with two extra bounds. At each node the
 * algorithm maintains:
 *
 *   - α: the best value the MAX player is guaranteed so far.
 *   - β: the best value the MIN player is guaranteed so far.
 *
 * When a child returns a value that makes the current node worse for the
 * opponent than a sibling already did (value ≥ β at a MAX node, or value ≤ α
 * at a MIN node), the remaining children are *pruned* — they cannot affect the
 * root value. This cuts the explored tree dramatically without changing the
 * result.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^(d/2)) with good move ordering (vs O(b^d) for minimax)
 *   Space: O(d)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Evaluated nodes are GREEN (sorted).
 *   - Pruned subtrees are RED (swapped).
 *   - The current α/β window is narrated.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Pruning never changes the answer – only the work done.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a balanced game tree.
 *
 * @param depth Remaining depth (0 = leaf).
 * @param branch The branching factor.
 * @param id Counter for node ids.
 * @param parent Parent node id (or "root").
 * @returns A list of nodes (with parentId metadata).
 */
function buildTree(
    depth: number,
    branch: number,
    id: { value: number },
    parent: string | null,
): VisualEntity[] {
    const current = id.value;
    id.value += 1;
    const nodes: VisualEntity[] = [
        {
            id: `node-${current}`,
            type: "node" as const,
            label: String(current),
            value: current,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent ?? "root" },
        },
    ];
    if (depth > 0) {
        for (let i = 0; i < branch; i += 1) {
            nodes.push(...buildTree(depth - 1, branch, id, `node-${current}`));
        }
    }
    return nodes;
}

/**
 * The Alpha-Beta generator.
 *
 * @param input `{ leaves }` – the leaf values.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { leaves?: number[] } | null) ?? {};
    const leaves = task.leaves ?? [
        3, 5, 2, 6, 1, 4, 7, 2, 8, 1, 9, 3, 5, 4, 2, 8, 6, 3, 2, 7, 1, 4, 9, 5, 3, 8, 6,
    ];

    let step = 0;

    const id = { value: 0 };
    const nodes = buildTree(3, 3, id, null);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const childrenOf = new Map<string, string[]>();
    for (const node of nodes) {
        const parent = String(node.metadata["parentId"]);
        const list = childrenOf.get(parent) ?? [];
        list.push(node.id);
        childrenOf.set(parent, list);
    }

    // Structural leaves (nodes with no children), in creation order.
    const leafIds = nodes.filter((n) => (childrenOf.get(n.id) ?? []).length === 0).map((n) => n.id);
    leafIds.forEach((leafId, index) => {
        const node = nodeById.get(leafId);
        if (node) {
            node.label = String(leaves[index] ?? 0);
        }
    });

    // Track which nodes are pruned (never evaluated).
    const pruned = new Set<string>();

    // Frame 0: the tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: [],
        description: "Alpha-beta pruning on a depth-3 ternary game tree.",
        codeLineNumber: 0,
        layout: "tree",
        meta: {},
    };
    step += 1;

    let pruningHappened = false;

    const alphaBeta = function* (
        nodeId: string,
        depth: number,
        isMax: boolean,
        alpha: number,
        beta: number,
    ): Generator<VisualFrame, number, unknown> {
        const children = childrenOf.get(nodeId) ?? [];

        if (children.length === 0) {
            // Leaf: return its value.
            const node = nodeById.get(nodeId);
            const val = Number(node?.label ?? 0);
            if (node) {
                node.state = "visited";
            }
            return val;
        }

        const node = nodeById.get(nodeId);
        if (node) {
            node.state = "comparing";
        }
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: [],
            description: `${isMax ? "MAX" : "MIN"} node (α=${alpha}, β=${beta}).`,
            codeLineNumber: 2,
            layout: "tree",
            meta: {},
        };
        step += 1;

        if (isMax) {
            let value = -Infinity;
            for (const child of children) {
                const childValue = yield* alphaBeta(child, depth + 1, false, alpha, beta);
                value = Math.max(value, childValue);
                alpha = Math.max(alpha, value);
                // Prune: the MIN player would never allow this branch.
                if (alpha >= beta) {
                    // Mark remaining children as pruned.
                    const idx = children.indexOf(child);
                    for (let i = idx + 1; i < children.length; i += 1) {
                        pruned.add(children[i] ?? "");
                    }
                    pruningHappened = true;
                    if (node) {
                        node.state = "swapped";
                    }
                    yield {
                        stepNumber: step,
                        entities: nodes.map((n) => ({ ...n })),
                        edges: [],
                        description: `Pruned remaining children of ${nodeId} (α=${alpha} ≥ β=${beta}).`,
                        codeLineNumber: 3,
                        layout: "tree",
                        meta: {},
                    };
                    step += 1;
                    break;
                }
            }
            if (node) {
                node.state = "sorted";
                node.label = String(value);
            }
            return value;
        }

        // MIN node.
        let value = Infinity;
        for (const child of children) {
            const childValue = yield* alphaBeta(child, depth + 1, true, alpha, beta);
            value = Math.min(value, childValue);
            beta = Math.min(beta, value);
            if (alpha >= beta) {
                const idx = children.indexOf(child);
                for (let i = idx + 1; i < children.length; i += 1) {
                    pruned.add(children[i] ?? "");
                }
                pruningHappened = true;
                if (node) {
                    node.state = "swapped";
                }
                yield {
                    stepNumber: step,
                    entities: nodes.map((n) => ({ ...n })),
                    edges: [],
                    description: `Pruned remaining children of ${nodeId} (α=${alpha} ≥ β=${beta}).`,
                    codeLineNumber: 3,
                    layout: "tree",
                    meta: {},
                };
                step += 1;
                break;
            }
        }
        if (node) {
            node.state = "sorted";
            node.label = String(value);
        }
        return value;
    };

    const rootId = nodes[0]?.id ?? "";
    const value = yield* alphaBeta(rootId, 0, true, -Infinity, Infinity);

    // Color pruned subtrees red (roots and all their descendants).
    const paintPruned = (id: string): void => {
        const node = nodeById.get(id);
        if (node) {
            node.state = "swapped";
        }
        for (const child of childrenOf.get(id) ?? []) {
            paintPruned(child);
        }
    };
    for (const prunedId of pruned) {
        paintPruned(prunedId);
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: [],
        description: `Game value = ${value}${pruningHappened ? `, with ${pruned.size} pruned node(s).` : ""}`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { value, pruned: pruned.size },
    };
}

/** The Alpha-Beta module, registered with the engine. */
const module: AlgorithmModule = {
    id: "alpha-beta",
    name: "Alpha-Beta Pruning",
    category: "game",
    complexity: { time: "O(b^(d/2))", space: "O(d)" },
    // Same tree as Minimax for a direct comparison.
    defaultInput: {
        leaves: [3, 5, 2, 6, 1, 4, 7, 2, 8, 1, 9, 3, 5, 4, 2, 8, 6, 3, 2, 7, 1, 4, 9, 5, 3, 8, 6],
    },
    visualType: "tree",
    run,
};

export default module;

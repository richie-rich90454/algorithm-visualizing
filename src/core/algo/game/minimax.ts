/**
 * minimax.ts – Minimax Search (game tree)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Minimax evaluates a deterministic two-player, zero-sum game by traversing
 * its game tree. At MAX nodes the player picks the child with the highest
 * score; at MIN nodes the opponent picks the child with the lowest score.
 * The value backed up to the root is the game value under optimal play.
 *
 * This educational version uses a small abstract game tree (a balanced
 * ternary tree of depth 3) to show the back-propagation clearly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^d) – the full game tree
 *   Space: O(d)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The node being evaluated is YELLOW (comparing).
 *   - The best child at a MAX/MIN node is GREEN (sorted).
 *   - Leaf values are shown on the leaves.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Alpha-beta pruning (next) avoids most of the tree.
 *   - The min/max alternation is the entire concept.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a balanced game tree of given depth and branching factor.
 *
 * @param depth Remaining depth (0 = leaf).
 * @param branch The branching factor.
 * @param id Counter for node ids.
 * @param parent Parent node id (or "root").
 * @returns A list of nodes (with parentId metadata for the tree layout).
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
            nodes.push(...buildTree(depth - 1, branch, id, String(current)));
        }
    }
    return nodes;
}

/**
 * The Minimax generator.
 *
 * @param input `{ leaves }` – the leaf values (a complete bottom row).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { leaves?: number[] } | null) ?? {};
    // A depth-3 ternary tree: 27 leaves.
    const leaves = task.leaves ?? [
        3, 5, 2, 6, 1, 4, 7, 2, 8, 1, 9, 3, 5, 4, 2, 8, 6, 3, 2, 7, 1, 4, 9, 5, 3, 8, 6,
    ];

    let step = 0;

    const id = { value: 0 };
    const nodes = buildTree(3, 3, id, null);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Leaf nodes are the last 27 created.
    const leafCount = leaves.length;
    const leafIds = nodes.slice(nodes.length - leafCount).map((n) => n.id);

    // Frame 0: the tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: [],
        description: "Minimax on a depth-3 ternary game tree.",
        codeLineNumber: 0,
        layout: "tree",
        meta: {},
    };
    step += 1;

    // Assign leaf values and evaluate the tree bottom-up.
    leafIds.forEach((leafId, index) => {
        const node = nodeById.get(leafId);
        if (node) {
            node.label = String(leaves[index] ?? 0);
        }
    });

    // Evaluate bottom-up: work on a copy of values.
    // valueOf(nodeId): undefined until evaluated.
    const valueOf = new Map<string, number>();

    // Build parent-child relationships from the metadata.
    const childrenOf = new Map<string, string[]>();
    for (const node of nodes) {
        const parent = String(node.metadata["parentId"]);
        const list = childrenOf.get(parent) ?? [];
        list.push(node.id);
        childrenOf.set(parent, list);
    }

    const evaluate = function* (
        nodeId: string,
        depth: number,
        isMax: boolean,
    ): Generator<VisualFrame, number, unknown> {
        const children = childrenOf.get(nodeId) ?? [];

        if (children.length === 0) {
            // Leaf: return its assigned value.
            const node = nodeById.get(nodeId);
            const val = Number(node?.label ?? 0);
            valueOf.set(nodeId, val);
            if (node) {
                node.state = "visited";
            }
            return val;
        }

        // MAX node: best (max) of children; MIN node: worst (min).
        const childValues: number[] = [];
        for (const child of children) {
            childValues.push(yield* evaluate(child, depth + 1, !isMax));
        }

        const node = nodeById.get(nodeId);
        const result = isMax ? Math.max(...childValues) : Math.min(...childValues);
        valueOf.set(nodeId, result);
        if (node) {
            node.state = "comparing";
            node.label = String(result);
        }
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: [],
            description: `${isMax ? "MAX" : "MIN"} node chose ${result} from {${childValues.join(", ")}}.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: {},
        };
        step += 1;
        if (node) {
            node.state = "sorted";
        }
        return result;
    };

    const rootId = nodes[0]?.id ?? "";
    const rootValue = yield* evaluate(rootId, 0, true);

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: [],
        description: `Game value under optimal play = ${rootValue}.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { value: rootValue },
    };
}

/** The Minimax module, registered with the engine. */
const module: AlgorithmModule = {
    id: "minimax",
    name: "Minimax",
    category: "game",
    complexity: { time: "O(b^d)", space: "O(d)" },
    // A depth-3 ternary game tree with fixed leaf values.
    defaultInput: {
        leaves: [3, 5, 2, 6, 1, 4, 7, 2, 8, 1, 9, 3, 5, 4, 2, 8, 6, 3, 2, 7, 1, 4, 9, 5, 3, 8, 6],
    },
    visualType: "tree",
    run,
};

export default module;

/**
 * tree-euler-tour.ts – Tree Euler Tour (with subtrees as intervals)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An Euler tour assigns each node an entry timestamp (tin) and exit timestamp
 * (tout) by a DFS. The beautiful consequence: the subtree of any node occupies
 * a *contiguous interval* of timestamps, which turns subtree queries into
 * range queries on an array (exactly what Fenwick/segment trees exploit).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V) – one DFS
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The node being entered is YELLOW (comparing).
 *   - Its subtree interval is hinted on the timeline.
 *   - Finished nodes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The tin/tout interval trick is the foundation of subtree-query
 *     problems in competitive programming.
 *   - Also called the "flattened tree".
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

/**
 * The Tree Euler Tour generator.
 *
 * @param input `{ parentMap, ids }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { parentMap?: Record<string, string | null>; ids?: string[] } | null) ?? {};
    const parentMap = new Map<string, string | null>(
        Object.entries(
            task.parentMap ?? {
                B: "A",
                C: "A",
                D: "B",
                E: "B",
                F: "C",
                G: "E",
                H: "G",
            },
        ),
    );
    const ids = task.ids ?? ["A", "B", "C", "D", "E", "F", "G", "H"];

    const nodes = makeTreeNodes(parentMap, ids);
    const edges = makeTreeEdges(parentMap, ids);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const children = new Map<string, string[]>();
    for (const id of ids) {
        children.set(id, []);
    }
    for (const [child, parent] of parentMap) {
        if (parent) {
            children.get(parent)?.push(child);
        }
    }
    const root = ids.find((id) => parentMap.get(id) === null) ?? ids[0] ?? "A";

    let step = 0;
    let timer = 0;
    const tin = new Map<string, number>();
    const tout = new Map<string, number>();

    // Frame 0: the untouched tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Tree Euler tour – assigning each node an entry and exit timestamp.",
        codeLineNumber: 0,
        layout: "tree",
        meta: {},
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "tree",
        meta: { step, timer },
    });

    const dfs = function* (node: string): Generator<VisualFrame, void, unknown> {
        // Entry timestamp.
        tin.set(node, timer);
        timer += 1;

        const nodeEntity = nodeById.get(`node-${node}`);
        if (nodeEntity) {
            nodeEntity.state = "comparing";
            nodeEntity.label = `${node} [${tin.get(node)}]`;
        }
        yield buildFrame(`Entering ${node} – tin = ${tin.get(node)}.`);
        step += 1;

        for (const child of children.get(node) ?? []) {
            const edge = edges.find(
                (e) => e.sourceId === `node-${node}` && e.targetId === `node-${child}`,
            );
            if (edge) {
                for (const e of edges) {
                    e.state = "idle";
                }
                edge.state = "active";
            }
            yield* dfs(child);
        }

        // Exit timestamp.
        tout.set(node, timer - 1);
        if (nodeEntity) {
            nodeEntity.state = "sorted";
            nodeEntity.label = `${node} [${tin.get(node)}..${tout.get(node)}]`;
        }
        yield buildFrame(
            `Leaving ${node} – its subtree covers [${tin.get(node)}..${tout.get(node)}].`,
        );
        step += 1;
    };

    yield* dfs(root);

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Euler tour complete – every subtree is now a contiguous interval.",
        codeLineNumber: 4,
        layout: "tree",
        meta: { timer },
    };
}

/** The Tree Euler Tour module, registered with the engine. */
const module: AlgorithmModule = {
    education: {
        "intuition": "An Euler tour records a timestamp when a node is entered and another when it is exited. The key consequence is that a node's entire subtree occupies one contiguous interval of timestamps, turning subtree questions into range queries on an array.",
        "invariants": [
            "tin[u] is assigned when u is first visited and tout[u] when its DFS finishes.",
            "A node v is in u's subtree exactly when tin[u] <= tin[v] <= tout[u].",
            "Timestamps are unique and increase monotonically along the DFS."
        ],
        "correctness": "Depth-first search explores a node's whole subtree before returning to its ancestors, so every descendant is entered between the entry and exit of that node. Hence the subtree corresponds exactly to the timestamp interval [tin, tout]. Testing interval containment therefore answers ancestry and subtree membership correctly, and the contiguous layout lets array range structures answer aggregate subtree queries.",
        "complexityRationale": "A single DFS assigns two timestamps per node, costing O(n) time. The timer and timestamp arrays use O(n) space.",
        "uses": [
            "Subtree sum queries with Fenwick or segment trees",
            "Ancestry testing in rooted trees",
            "Flattening trees for range-based algorithms"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 22 (DFS timestamps)",
            "Competitive Programming 3, Hall and Li, tree chapter"
        ],
        "workedExample": "For tree A with children B and C, and B with child D, one tour gives tin A = 0, tin B = 1, tin D = 2, tout D = 3, tout B = 4, tin C = 5, tout C = 6, tout A = 7. B's subtree is exactly the interval [1,4]."
    },

    id: "tree-euler-tour",
    name: "Tree Euler Tour",
    category: "tree",
    complexity: { time: "O(V)", space: "O(V)" },
    // The standard tree; intervals are easy to verify by hand.
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "start DFS at root with timer set to zero",
        "record entry time tin when entering node",
        "recurse into each child then return",
        "record exit time tout covering subtree interval",
        "return all tin and tout intervals as the answer",
    ],
};

export default module;

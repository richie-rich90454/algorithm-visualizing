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
        meta: {},
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
};

export default module;

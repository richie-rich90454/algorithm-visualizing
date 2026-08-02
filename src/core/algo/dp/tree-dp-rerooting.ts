/**
 * tree-dp-rerooting.ts – Tree DP with Rerooting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rerooting DP computes a tree DP for *every possible root* in O(V). After a
 * down pass (children → parent), an up pass propagates the "outside" answer
 * into each child. This example solves: for every vertex, the sum of distances
 * from it to all other vertices. The rerooting formula reuses the down-pass
 * values so each new root answer is computed in O(1).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V)
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The down pass is narrated first.
 *   - The up pass is highlighted.
 *   - Each node's final rerooted answer is shown.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The two-pass structure is the universal rerooting template.
 *   - Contrast with the dedicated "rerooting-dp" tree algorithm.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "../tree/tree-util";

/**
 * The Tree DP Rerooting generator.
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

    // Frame 0: the untouched tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Rerooting DP – sum of distances from every possible root.",
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

    // Down pass: subtree size and internal distance sums.
    const subSize = new Map<string, number>();
    const subDist = new Map<string, number>();

    const down = function* (node: string): Generator<VisualFrame, [number, number], unknown> {
        let size = 1;
        let dist = 0;
        for (const child of children.get(node) ?? []) {
            const [childSize, childDist] = yield* down(child);
            dist += childDist + childSize;
            size += childSize;
        }
        subSize.set(node, size);
        subDist.set(node, dist);
        return [size, dist];
    };
    yield* down(root);

    yield buildFrame("Down pass complete – subtree sizes and distances.");
    step += 1;

    // Up pass: outside values then final answers.
    const outside = new Map<string, number>();
    const answer = new Map<string, number>();
    outside.set(root, 0);
    answer.set(root, subDist.get(root) ?? 0);

    const up = function* (node: string): Generator<VisualFrame, void, unknown> {
        const nodeSize = subSize.get(node) ?? 0;
        const nodeOutside = outside.get(node) ?? 0;
        const nodeSubDist = subDist.get(node) ?? 0;

        const nodeEntity = nodeById.get(`node-${node}`);
        if (nodeEntity) {
            nodeEntity.state = "active";
            nodeEntity.label = String(answer.get(node) ?? 0);
        }
        yield buildFrame(`${node}: total distance ${answer.get(node)}.`);
        step += 1;

        for (const child of children.get(node) ?? []) {
            const childSize = subSize.get(child) ?? 0;
            const childSubDist = subDist.get(child) ?? 0;
            // outside[child] = (node's other-subtree distances) + node's outside + (#other nodes)·1
            const otherNodes = nodeSize - childSize;
            const childOutside =
                nodeSubDist - (childSubDist + childSize) + nodeOutside + otherNodes;
            outside.set(child, childOutside);
            answer.set(child, childSubDist + childOutside);

            yield* up(child);
        }
    };
    yield* up(root);

    // Mark all answered nodes green.
    for (const node of nodes) {
        if (node.state === "active") {
            node.state = "sorted";
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Rerooting complete – each node shows the sum of distances to all others.",
        codeLineNumber: 4,
        layout: "tree",
        meta: { answers: [...answer.values()] },
    };
}

/** The Tree DP Rerooting module, registered with the engine. */
const module: AlgorithmModule = {
    id: "tree-dp-rerooting",
    name: "Tree DP (Rerooting)",
    category: "dynamic-programming",
    complexity: { time: "O(V)", space: "O(V)" },
    // The standard tree for a clean two-pass demonstration.
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
    },
    visualType: "tree",
    run,
};

export default module;

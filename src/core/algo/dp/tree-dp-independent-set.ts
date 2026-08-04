/**
 * tree-dp-independent-set.ts – Tree DP: Maximum Weight Independent Set
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A maximum weight independent set of a tree is a set of vertices, no two
 * adjacent, with maximum total weight. The tree DP uses two values per node:
 *
 *   dp[node][0] = best weight in the subtree if node is NOT taken
 *   dp[node][1] = best weight in the subtree if node IS taken
 *
 * With children c:
 *   dp[node][0] = Σ max(dp[c][0], dp[c][1])
 *   dp[node][1] = weight[node] + Σ dp[c][0]
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V)
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The node being processed is YELLOW (comparing).
 *   - Nodes selected in the set are GREEN (sorted).
 *   - The two DP values are narrated.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "take vs skip" two-state tree DP template.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "../tree/tree-util";

/**
 * The Tree DP Independent Set generator.
 *
 * @param input `{ parentMap, ids, weights }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            parentMap?: Record<string, string | null>;
            ids?: string[];
            weights?: Record<string, number>;
        } | null) ?? {};
    const parentMap = new Map<string, string | null>(
        Object.entries(
            task.parentMap ?? {
                B: "A",
                C: "A",
                D: "B",
                E: "B",
                F: "C",
                G: "E",
            },
        ),
    );
    const ids = task.ids ?? ["A", "B", "C", "D", "E", "F", "G"];
    const weights = task.weights ?? { A: 3, B: 2, C: 4, D: 5, E: 1, F: 2, G: 6 };

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
        description: "Maximum weight independent set – two-state tree DP.",
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

    // dp0 / dp1 per node.
    const dp0 = new Map<string, number>();
    const dp1 = new Map<string, number>();

    const dfs = function* (node: string): Generator<VisualFrame, void, unknown> {
        const nodeEntity = nodeById.get(`node-${node}`);
        if (nodeEntity) {
            nodeEntity.state = "comparing";
        }
        yield buildFrame(`Processing ${node} (weight ${weights[node] ?? 0}).`);
        step += 1;

        let sum0 = 0;
        let sum1 = weights[node] ?? 0;

        for (const child of children.get(node) ?? []) {
            yield* dfs(child);
            sum0 += Math.max(dp0.get(child) ?? 0, dp1.get(child) ?? 0);
            sum1 += dp0.get(child) ?? 0;
        }

        dp0.set(node, sum0);
        dp1.set(node, sum1);

        if (nodeEntity) {
            nodeEntity.state = "visited";
        }
        yield buildFrame(`${node}: not-taken=${sum0}, taken=${sum1}.`);
        step += 1;
    };

    yield* dfs(root);

    const best = Math.max(dp0.get(root) ?? 0, dp1.get(root) ?? 0);

    // Reconstruct a concrete set (greedy top-down using the DP).
    const selected = new Set<string>();
    const reconstruct = (node: string, take: boolean): void => {
        if (take) {
            selected.add(node);
            for (const child of children.get(node) ?? []) {
                reconstruct(child, false);
            }
        } else {
            for (const child of children.get(node) ?? []) {
                reconstruct(child, (dp1.get(child) ?? 0) >= (dp0.get(child) ?? 0));
            }
        }
    };
    reconstruct(root, (dp1.get(root) ?? 0) >= (dp0.get(root) ?? 0));

    for (const id of selected) {
        const node = nodeById.get(`node-${id}`);
        if (node) {
            node.state = "sorted";
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Maximum weight independent set = ${best}, using {${[...selected].join(", ")}}.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { best, selected: [...selected] },
    };
}

/** The Tree DP Independent Set module, registered with the engine. */
const module: AlgorithmModule = {
    id: "tree-dp-independent-set",
    name: "Tree DP (Independent Set)",
    category: "dynamic-programming",
    complexity: { time: "O(V)", space: "O(V)" },
    // A weighted tree with a clear optimal selection.
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E" },
        ids: ["A", "B", "C", "D", "E", "F", "G"],
        weights: { A: 3, B: 2, C: 4, D: 5, E: 1, F: 2, G: 6 },
    },
    visualType: "tree",
    run,
};

export default module;

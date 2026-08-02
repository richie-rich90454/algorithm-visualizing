/**
 * lca-binary-lifting.ts – Lowest Common Ancestor (Binary Lifting)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The lowest common ancestor (LCA) of two nodes u and v in a rooted tree is
 * the deepest node that is an ancestor of both. Binary lifting precomputes
 * `up[k][node]` – the 2^k-th ancestor of each node – then answers LCA queries
 * in O(log V):
 *
 *   1. Lift the deeper node up so both are at the same depth.
 *   2. Lift both nodes together, from the largest k downward, skipping as long
 *      as their 2^k-th ancestors differ.
 *   3. The parent of either node is the LCA.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Preprocess: O(V log V) time, O(V log V) space
 *   Query:      O(log V)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The two query nodes are YELLOW (comparing).
 *   - The node being lifted is BLUE (active).
 *   - The found LCA is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - One of the most-used tree tools in competitive programming.
 *   - The lifting table is a great example of doubling / sparse tables.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

/**
 * The LCA (Binary Lifting) generator.
 *
 * @param input `{ parentMap, ids, query }` where query is `[u, v]`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            parentMap?: Record<string, string | null>;
            ids?: string[];
            query?: [string, string];
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
                H: "G",
            },
        ),
    );
    const ids = task.ids ?? ["A", "B", "C", "D", "E", "F", "G", "H"];
    const query = task.query ?? ["D", "H"];

    const nodes = makeTreeNodes(parentMap, ids);
    const edges = makeTreeEdges(parentMap, ids);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // ------------------------------------------------------------------
    // Precompute depths and the lifting table up[k][node].
    // ------------------------------------------------------------------
    const depth = new Map<string, number>();
    const up = new Map<string, Map<number, string>>();

    const root = ids.find((id) => parentMap.get(id) === null) ?? ids[0] ?? "A";

    // A simple DFS computes depth for every node.
    const children = new Map<string, string[]>();
    for (const id of ids) {
        children.set(id, []);
    }
    for (const [child, parent] of parentMap) {
        if (parent) {
            children.get(parent)?.push(child);
        }
    }

    const dfs = (node: string, parent: string | null, d: number): void => {
        depth.set(node, d);
        const ancestors = new Map<number, string>();
        ancestors.set(0, parent ?? node);
        // up[k][node] = up[k-1][ up[k-1][node] ]
        for (let k = 1; k < 4; k += 1) {
            const mid = ancestors.get(k - 1) ?? node;
            ancestors.set(k, up.get(mid)?.get(k - 1) ?? mid);
        }
        up.set(node, ancestors);
        for (const child of children.get(node) ?? []) {
            dfs(child, node, d + 1);
        }
    };
    dfs(root, null, 0);

    let step = 0;

    // Frame 0: the untouched tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Finding the LCA of ${query[0]} and ${query[1]} with binary lifting.`,
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

    // ------------------------------------------------------------------
    // Answer the query.
    // ------------------------------------------------------------------
    let u = query[0];
    let v = query[1];

    const highlight = (id: string, state: VisualEntity["state"]): void => {
        const node = nodeById.get(`node-${id}`);
        if (node) {
            node.state = state;
        }
    };

    highlight(u, "comparing");
    highlight(v, "comparing");
    yield buildFrame(`Starting query: u=${u}, v=${v}.`);
    step += 1;

    // Step 1: bring both nodes to the same depth.
    while ((depth.get(u) ?? 0) > (depth.get(v) ?? 0)) {
        // Lift u by one (educational; production uses the table in one jump).
        u = up.get(u)?.get(0) ?? u;
        highlight(u, "active");
        yield buildFrame(`Lifting ${u} to depth ${depth.get(u)}.`);
        step += 1;
    }
    while ((depth.get(v) ?? 0) > (depth.get(u) ?? 0)) {
        v = up.get(v)?.get(0) ?? v;
        highlight(v, "active");
        yield buildFrame(`Lifting ${v} to depth ${depth.get(v)}.`);
        step += 1;
    }

    // If they already met, that node is the LCA.
    if (u === v) {
        highlight(u, "sorted");
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `The LCA is ${u}.`,
            codeLineNumber: 3,
            layout: "tree",
            meta: { lca: u },
        };
        return;
    }

    // Step 2: lift both together, skipping as long as ancestors differ.
    for (let k = 3; k >= 0; k -= 1) {
        const upU = up.get(u)?.get(k) ?? u;
        const upV = up.get(v)?.get(k) ?? v;
        if (upU !== upV) {
            u = upU;
            v = upV;
            highlight(u, "active");
            highlight(v, "active");
            yield buildFrame(`Jumped both up by 2^${k}.`);
            step += 1;
        }
    }

    // Step 3: the parent of either is the LCA.
    const lca = up.get(u)?.get(0) ?? u;
    highlight(lca, "sorted");

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `The LCA of ${query[0]} and ${query[1]} is ${lca}.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { lca },
    };
}

/** The LCA (Binary Lifting) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "lca-binary-lifting",
    name: "LCA (Binary Lifting)",
    category: "tree",
    complexity: { time: "O(log V) / query", space: "O(V log V)" },
    // LCA of D and H in this tree is B.
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
        query: ["D", "H"],
    },
    visualType: "tree",
    run,
};

export default module;

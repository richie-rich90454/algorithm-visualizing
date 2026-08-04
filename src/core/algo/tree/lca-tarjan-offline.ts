/**
 * lca-tarjan-offline.ts – Lowest Common Ancestor (Tarjan's offline algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tarjan's algorithm answers a *batch* of LCA queries offline (all queries
 * known up front) with a single DFS plus a disjoint-set union. As the DFS
 * unwinds, each visited subtree is merged into its parent's set; a query
 * (u, v) is answered when the DFS finishes the second of the two nodes, using
 * the `find` of the *first* node's set. The result is a near-linear algorithm
 * for all queries at once.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((V + Q) · α(V)) with union-find path compression
 *   Space: O(V + Q)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The node currently being finished by the DFS is YELLOW (comparing).
 *   - Merged components are hinted by node color.
 *   - Answered LCA nodes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Answers many queries at once, unlike the online methods.
 *   - Combines DFS, DSU, and clever bookkeeping in one algorithm.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

/**
 * A tiny union-find (disjoint set).
 */
class UnionFind {
    private parent = new Map<string, string>();

    find(x: string): string {
        if (this.parent.get(x) === undefined) {
            this.parent.set(x, x);
        }
        const root = this.parent.get(x) as string;
        if (root !== x) {
            this.parent.set(x, this.find(root));
        }
        return this.parent.get(x) as string;
    }

    union(a: string, b: string): void {
        this.parent.set(this.find(a), this.find(b));
    }
}

/**
 * The Tarjan Offline LCA generator.
 *
 * @param input `{ parentMap, ids, queries }` where queries is a list of
 *        `[u, v]` pairs.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            parentMap?: Record<string, string | null>;
            ids?: string[];
            queries?: Array<[string, string]>;
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
    const queries: Array<[string, string]> = task.queries ?? [
        ["D", "H"],
        ["D", "E"],
    ];

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

    // Per-node query buckets: queries adjacent to each node.
    const queryBuckets = new Map<string, Array<{ other: string; index: number }>>();
    for (const id of ids) {
        queryBuckets.set(id, []);
    }
    queries.forEach(([a, b], index) => {
        queryBuckets.get(a)?.push({ other: b, index });
        queryBuckets.get(b)?.push({ other: a, index });
    });

    let step = 0;
    const answers = new Map<number, string>();
    const uf = new UnionFind();
    const ancestor = new Map<string, string>();
    const finished = new Set<string>();

    // Frame 0: the untouched tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Tarjan's offline LCA – answering ${queries.length} query/queries in one DFS.`,
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
        meta: { answered: answers.size },
    });

    const dfs = function* (node: string): Generator<VisualFrame, void, unknown> {
        ancestor.set(node, node);
        uf.find(node);

        // Recurse into every child.
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
            yield buildFrame(`Descending into ${child}.`);
            step += 1;

            yield* dfs(child);

            // Merge the child's component into the current node's.
            uf.union(node, child);
            ancestor.set(uf.find(node), node);
        }

        // Mark the node finished.
        finished.add(node);
        const nodeEntity = nodeById.get(`node-${node}`);
        if (nodeEntity) {
            nodeEntity.state = "comparing";
        }
        yield buildFrame(`Finished ${node}.`);
        step += 1;

        // Answer every query that touches this node and whose other endpoint
        // is already finished.
        for (const { other, index } of queryBuckets.get(node) ?? []) {
            if (finished.has(other) && !answers.has(index)) {
                const lca = ancestor.get(uf.find(other)) ?? "";
                answers.set(index, lca);

                const lcaEntity = nodeById.get(`node-${lca}`);
                if (lcaEntity) {
                    lcaEntity.state = "sorted";
                }
                yield buildFrame(`Query (${other}, ${node}) answered: LCA = ${lca}.`);
                step += 1;
            }
        }

        if (nodeEntity) {
            nodeEntity.state = "visited";
        }
    };

    yield* dfs(root);

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Tarjan offline LCA complete – answered ${answers.size} query/queries.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { answered: answers.size },
    };
}

/** The Tarjan Offline LCA module, registered with the engine. */
const module: AlgorithmModule = {
    id: "lca-tarjan-offline",
    name: "LCA (Tarjan Offline)",
    category: "tree",
    complexity: { time: "O((V + Q)·α(V))", space: "O(V + Q)" },
    // Two queries on the standard tree: (D,H) → B, (D,E) → B.
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
        queries: [
            ["D", "H"],
            ["D", "E"],
        ],
    },
    visualType: "tree",
    run,
};

export default module;

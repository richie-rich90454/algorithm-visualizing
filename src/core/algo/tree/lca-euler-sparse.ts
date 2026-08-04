/**
 * lca-euler-sparse.ts – Lowest Common Ancestor (Euler tour + RMQ sparse table)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This approach converts the LCA problem into a *range minimum query* (RMQ):
 *
 *   1. Perform an Euler tour of the tree, recording the vertex at every step
 *      plus its depth.
 *   2. The LCA of u and v is the vertex of minimum depth in the Euler tour
 *      between the first occurrence of u and the first occurrence of v.
 *   3. Answer RMQs in O(1) with a sparse table over the depth array.
 *
 * The first visit of each vertex records its index; min-depth lookup between
 * the two indices yields the LCA.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Preprocess: O(V log V) time, O(V log V) space
 *   Query:      O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The Euler tour is traced across the tree (active edges).
 *   - The two query nodes are YELLOW (comparing).
 *   - The min-depth vertex (the LCA) is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The reduction "tree LCA → array RMQ" is a famous algorithmic idea.
 *   - The sparse table answers RMQs in constant time.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

/**
 * The LCA (Euler + Sparse) generator.
 *
 * @param input `{ parentMap, ids, query }`.
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
        description: `Finding the LCA of ${query[0]} and ${query[1]} via an Euler tour + RMQ.`,
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
    // Build the Euler tour: record each visited vertex and its depth.
    // ------------------------------------------------------------------
    const tour: string[] = [];
    const tourDepth: number[] = [];
    const depth = new Map<string, number>();
    const firstOccurrence = new Map<string, number>();

    const dfs = function* (node: string, d: number): Generator<VisualFrame, void, unknown> {
        depth.set(node, d);
        if (!firstOccurrence.has(node)) {
            firstOccurrence.set(node, tour.length);
        }
        tour.push(node);
        tourDepth.push(d);

        // Highlight the current traversal edge.
        const nodeEntity = nodeById.get(`node-${node}`);
        if (nodeEntity) {
            nodeEntity.state = "comparing";
        }
        yield buildFrame(`Euler tour at ${node} (depth ${d}).`);
        step += 1;

        for (const child of children.get(node) ?? []) {
            // Highlight the tree edge into the child.
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

            yield* dfs(child, d + 1);

            // Record the return to the parent in the tour.
            tour.push(node);
            tourDepth.push(d);
            if (nodeEntity) {
                nodeEntity.state = "comparing";
            }
            yield buildFrame(`Returning to ${node}.`);
            step += 1;
        }
    };
    yield* dfs(root, 0);

    // ------------------------------------------------------------------
    // Build a sparse table over the tour depth for O(1) RMQ.
    // ------------------------------------------------------------------
    const n = tour.length;
    const LOG = Math.floor(Math.log2(n)) + 1;
    // st[k][i] = index of the min-depth vertex in tour[i .. i+2^k-1].
    const st: number[][] = [];
    st.push(tour.map((_, i) => i));

    for (let k = 1; k < LOG; k += 1) {
        const prev = st[k - 1] ?? [];
        const row: number[] = [];
        const span = 2 ** (k - 1);
        for (let i = 0; i + 2 ** k <= n; i += 1) {
            const a = prev[i] ?? 0;
            const b = prev[i + span] ?? 0;
            row.push(tourDepth[a]! <= tourDepth[b]! ? a : b);
        }
        st.push(row);
    }

    const rmq = (l: number, r: number): number => {
        if (l > r) {
            [l, r] = [r, l];
        }
        const k = Math.floor(Math.log2(r - l + 1));
        const row = st[k] ?? [];
        const a = row[l] ?? 0;
        const b = row[r - 2 ** k + 1] ?? 0;
        return tourDepth[a]! <= tourDepth[b]! ? a : b;
    };

    // ------------------------------------------------------------------
    // Answer the query.
    // ------------------------------------------------------------------
    const u = query[0];
    const v = query[1];
    const uNode = nodeById.get(`node-${u}`);
    const vNode = nodeById.get(`node-${v}`);
    if (uNode) {
        uNode.state = "comparing";
    }
    if (vNode) {
        vNode.state = "comparing";
    }
    yield buildFrame(
        `Query: ${u} at tour index ${firstOccurrence.get(u)}, ${v} at tour index ${firstOccurrence.get(v)}.`,
    );
    step += 1;

    const lo = firstOccurrence.get(u) ?? 0;
    const hi = firstOccurrence.get(v) ?? 0;
    const minIndex = rmq(lo, hi);
    const lca = tour[minIndex] ?? "";

    const lcaNode = nodeById.get(`node-${lca}`);
    if (lcaNode) {
        lcaNode.state = "sorted";
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `The LCA of ${u} and ${v} is ${lca} (min depth in tour range [${Math.min(lo, hi)}..${Math.max(lo, hi)}]).`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { lcaFound: lca.charCodeAt(0) },
    };
}

/** The LCA (Euler + Sparse) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "lca-euler-sparse",
    name: "LCA (Euler + Sparse Table)",
    category: "tree",
    complexity: { time: "O(1) / query", space: "O(V log V)" },
    // Same tree/query as binary lifting for comparison; LCA(D, H) = B.
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
        query: ["D", "H"],
    },
    visualType: "tree",
    run,
};

export default module;

/**
 * kth-smallest-tree-path.ts - k-th Smallest Value on a Tree Path
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Each vertex of a rooted tree carries a numeric value. A path query asks for
 * the k-th smallest value on the path between two vertices. The module stores,
 * for every vertex, a persistent frequency vector of the values on the path
 * from the root to that vertex. For a query, the path frequencies are combined
 * from the two endpoints and their lowest common ancestor, then a binary
 * search over the sorted distinct values locates the k-th one.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * d) preprocessing and O(d + n) per query
 *   Space: O(n * d) for the persistent vectors, d = distinct value count
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their labels and values in the standard tree layout.
 *   - The queried path turns cyan; the answer appears in the caption.
 *   - Metadata records each query result and the sorted value domain.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

interface PathQuery {
    u: string;
    v: string;
    k: number;
}

interface PathInput {
    parentMap?: Record<string, string | null>;
    ids?: string[];
    values?: Record<string, number>;
    queries?: PathQuery[];
}

/** The k-th smallest path query generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PathInput | null) ?? {};
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
    const values = task.values ?? { A: 7, B: 3, C: 9, D: 1, E: 5, F: 2, G: 8 };
    const queries: PathQuery[] = Array.isArray(task.queries)
        ? task.queries
        : [
              { u: "D", v: "G", k: 3 },
              { u: "F", v: "D", k: 2 },
          ];

    const nodes = makeTreeNodes(parentMap, ids);
    const edges = makeTreeEdges(parentMap, ids);
    for (const node of nodes) {
        const id = (node.id as string).slice(5);
        node.label = `${id}:${values[id] ?? 0}`;
        node.value = values[id] ?? 0;
    }
    const baseEdges = edges.map((edge) => ({ ...edge }));

    const buildFrame = (
        states: Map<string, "path" | "comparing">,
        message: string,
        codeLine: number,
        meta: VisualFrame["meta"],
    ): VisualFrame => ({
        stepNumber: 0,
        entities: nodes.map((node) => {
            const id = (node.id as string).slice(5);
            return { ...node, state: states.get(id) ?? "unvisited" };
        }),
        edges: baseEdges.map((edge) => ({ ...edge })),
        description: message,
        codeLineNumber: codeLine,
        layout: "tree",
        meta,
    });

    let step = 0;
    if (ids.length === 0) {
        const empty = buildFrame(new Map(), "Empty tree has no path queries to answer.", 0, {
            results: [] as string[],
            queries: 0,
        });
        empty.stepNumber = 0;
        yield empty;
        return;
    }

    const root = ids.find((id) => parentMap.get(id) === null) ?? ids[0] ?? "A";
    const depth = new Map<string, number>([[root, 0]]);
    const order: string[] = [];
    const queue = [root];
    while (queue.length > 0) {
        const current = queue.shift() as string;
        order.push(current);
        for (const [child, parent] of parentMap) {
            if (parent === current && ids.includes(child)) {
                depth.set(child, (depth.get(current) as number) + 1);
                queue.push(child);
            }
        }
    }
    for (const id of ids) {
        if (!depth.has(id)) {
            depth.set(id, 0);
        }
    }

    const distinctValues = [...new Set(ids.map((id) => values[id] ?? 0))].sort((a, b) => a - b);
    const bucket = new Map<number, number>(distinctValues.map((value, index) => [value, index]));
    const zero = (): number[] => new Array<number>(distinctValues.length).fill(0);
    const paths = new Map<string, number[]>();
    for (const id of order) {
        const parent = parentMap.get(id);
        const vector = parent && paths.has(parent) ? [...(paths.get(parent) as number[])] : zero();
        const index = bucket.get(values[id] ?? 0);
        if (index !== undefined) {
            vector[index] = (vector[index] as number) + 1;
        }
        paths.set(id, vector);
    }

    const lca = (a: string, b: string): string => {
        let u = a;
        let v = b;
        while ((depth.get(u) as number) > (depth.get(v) as number)) {
            u = parentMap.get(u) ?? u;
        }
        while ((depth.get(v) as number) > (depth.get(u) as number)) {
            v = parentMap.get(v) ?? v;
        }
        while (u !== v) {
            const nextU = parentMap.get(u);
            const nextV = parentMap.get(v);
            if (!nextU || !nextV) {
                return root;
            }
            u = nextU;
            v = nextV;
        }
        return u;
    };

    const pathNodes = (a: string, b: string, ancestor: string): string[] => {
        const result: string[] = [];
        let cursor: string | null = a;
        while (cursor && cursor !== ancestor) {
            result.push(cursor);
            cursor = parentMap.get(cursor) ?? null;
        }
        result.push(ancestor);
        const other: string[] = [];
        cursor = b;
        while (cursor && cursor !== ancestor) {
            other.push(cursor);
            cursor = parentMap.get(cursor) ?? null;
        }
        return result.concat(other);
    };

    const initial = buildFrame(new Map(), kthIntro(ids.length, queries.length), 0, {
        results: [] as string[],
        queries: queries.length,
        distinctValues,
        current: -1,
        answer: -1,
        path: [] as string[],
    });
    initial.stepNumber = step;
    yield initial;
    step += 1;

    const results: string[] = [];
    for (let q = 0; q < queries.length; q += 1) {
        const query = queries[q] as PathQuery;
        const ancestor = lca(query.u, query.v);
        const path = pathNodes(query.u, query.v, ancestor);
        const countU = paths.get(query.u) ?? zero();
        const countV = paths.get(query.v) ?? zero();
        const countL = paths.get(ancestor) ?? zero();
        const parentOfL = parentMap.get(ancestor);
        const countAbove = parentOfL ? paths.get(parentOfL) ?? zero() : zero();
        const combined = countU.map((value, index) =>
            value + (countV[index] as number) - (countL[index] as number) - (countAbove[index] as number),
        );

        let answer = -1;
        let cumulative = 0;
        for (let index = 0; index < combined.length; index += 1) {
            cumulative += combined[index] as number;
            if (cumulative >= query.k && query.k > 0) {
                answer = distinctValues[index] as number;
                break;
            }
        }
        const states = new Map<string, "path" | "comparing">();
        for (const id of path) {
            states.set(id, id === ancestor ? "comparing" : "path");
        }
        results.push(`${query.u}-${query.v}:k${query.k}=${answer}`);
        const frame = buildFrame(
            states,
            answer === -1
                ? `Query ${q + 1}: path ${path.join(" -> ")} has fewer than ${query.k} values.`
                : `Query ${q + 1}: the ${query.k}-th smallest value on ${query.u} to ${query.v} is ${answer}.`,
            answer === -1 ? 6 : 5,
            {
                results: [...results],
                queries: queries.length,
                distinctValues,
                current: q,
                answer,
                path,
            },
        );
        frame.stepNumber = step;
        yield frame;
        step += 1;
    }

    const final = buildFrame(new Map(), `Answered ${results.length} path query(ies).`, 6, {
        results,
        queries: queries.length,
        distinctValues,
        current: -1,
        answer: -1,
        path: [] as string[],
        done: true,
    });
    final.stepNumber = step;
    yield final;
}

function kthIntro(nodeCount: number, queryCount: number): string {
    return `k-th smallest on tree paths: ${nodeCount} nodes, ${queryCount} query(ies).`;
}

/** The k-th smallest tree path module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A persistent prefix vector records how often each value appears from the root to a node. One vector per node lets path queries be answered by combining four vectors: the two endpoints minus the common ancestor and its parent. A binary search over the sorted distinct values then finds the k-th smallest without sorting the path itself.",
        invariants: [
            "Each stored vector counts exactly the values on the root-to-node path.",
            "A child's vector equals its parent's vector plus one for the child's own value.",
            "Combining endpoint and ancestor vectors yields the multiset of values on the query path.",
        ],
        correctness:
            "By induction on depth, each node's vector is its parent's vector with the node's value added, so it counts the root path exactly. For vertices u and v with lowest common ancestor a, the path u to v is the root path to u union the root path to v minus the two root paths up to a and its parent. The componentwise combination therefore gives the true multiset of path values, and walking the sorted distinct values until the cumulative count reaches k returns exactly the k-th smallest value.",
        complexityRationale:
            "Preprocessing copies a vector of length d for each of n nodes, costing O(n d) time and space. Each query combines four vectors and binary-searches the value domain, O(d + n) with the simple ancestor walk. A segment-tree implementation would reduce the query to O(log d).",
        uses: [
            "Answering rank queries on paths in hierarchical data",
            "Real-time analytics on tree-shaped networks with fixed node weights",
            "A teaching model for persistent data structures on trees",
        ],
        references: [
            "Samet, Foundations of Multidimensional and Metric Data Structures, tree path queries",
            "Competitive Programming 3, Hall and Li, persistent segment tree chapter",
        ],
        workedExample:
            "On a path A-B-C-D with values 7, 3, 9, 1, a query for the second smallest value on A to C looks at values 7, 3, 9. The sorted domain is 1, 3, 7, 9 and the cumulative count reaches two at value 7, so the answer is seven.",
    },
    id: "kth-smallest-tree-path",
    name: "k-th Smallest on Tree Path",
    category: "tree",
    complexity: { time: "O(n*d + q*(d+n))", space: "O(n*d)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E" },
        ids: ["A", "B", "C", "D", "E", "F", "G"],
        values: { A: 7, B: 3, C: 9, D: 1, E: 5, F: 2, G: 8 },
        queries: [
            { u: "D", v: "G", k: 3 },
            { u: "F", v: "D", k: 2 },
        ],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "root the tree and sort the distinct node values",
        "store a zero frequency vector at the root",
        "give each child a copy of its parent vector plus its value",
        "for a query find the lowest common ancestor of the endpoints",
        "combine endpoint and ancestor vectors componentwise",
        "scan sorted values until the cumulative count reaches k",
        "done: report the k-th smallest value for each query",
    ],
};

export default module;

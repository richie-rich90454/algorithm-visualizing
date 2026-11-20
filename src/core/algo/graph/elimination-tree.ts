/**
 * elimination-tree.ts - Elimination Tree of a Symmetric Sparse Matrix
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The elimination tree of a symmetric matrix summarizes the dependence structure
 * of sparse Cholesky. For a vertex j, its parent is the smallest vertex k > j
 * that can be reached from j along a path whose intermediate vertices all have
 * index at most j. Computing it with a union-find over the growing induced
 * subgraph avoids exploring a fresh path for every vertex.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V * (V + E)) with an explicit component scan
 *   Space: O(V + E) for the graph, the union-find, and the tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Original graph edges are faint; elimination-tree edges are highlighted.
 *   - The vertex being processed is YELLOW, its component is BLUE.
 *   - meta carries the parent array, with -1 for the single root.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const raw: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "D"],
        C: ["A", "D", "E"],
        D: ["B", "C"],
        E: ["C"],
    };

    const labels = [
        ...new Set([...Object.keys(raw), ...Object.values(raw).flat().map((v) => String(v))]),
    ].sort();
    const n = labels.length;
    const index = new Map(labels.map((v, i) => [v, i] as const));
    const neighbors: number[][] = Array.from({ length: n }, () => []);
    for (const a of labels) {
        for (const rawNeighbor of raw[a] ?? []) {
            const b = String(rawNeighbor);
            const i = index.get(a);
            const j = index.get(b);
            if (i === undefined || j === undefined || i === j) {
                continue;
            }
            if (!neighbors[i]?.includes(j)) {
                neighbors[i]?.push(j);
            }
            if (!neighbors[j]?.includes(i)) {
                neighbors[j]?.push(i);
            }
        }
    }

    const frames: VisualFrame[] = [];
    const parent = Array<number>(n).fill(-1);
    const treeEdges: Array<[number, number]> = [];

    const push = (description: string, line: number, current: number, component: Set<number>): void => {
        const nodes: VisualEntity[] = makeGraphNodes(labels);
        nodes.forEach((node, i) => {
            if (i === current) {
                node.state = "active";
            } else if (component.has(i)) {
                node.state = "comparing";
            } else {
                node.state = "unvisited";
            }
        });
        const edges: VisualEdge[] = [];
        for (let i = 0; i < n; i += 1) {
            for (const j of neighbors[i] ?? []) {
                if (j <= i) {
                    continue;
                }
                edges.push({
                    id: `edge-${labels[i]}-${labels[j]}`,
                    sourceId: `node-${labels[i]}`,
                    targetId: `node-${labels[j]}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
            }
        }
        treeEdges.forEach(([child, par], e) => {
            edges.push({
                id: `tree-${e}`,
                sourceId: `node-${labels[par]}`,
                targetId: `node-${labels[child]}`,
                label: "",
                state: "path",
                directed: true,
            });
        });
        frames.push({
            stepNumber: frames.length,
            entities: nodes,
            edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: { parent: [...parent], vertices: labels.length },
        });
    };

    if (n === 0) {
        push("Empty graph - no elimination tree.", 0, -1, new Set());
        for (const frame of frames) {
            yield frame;
        }
        return;
    }

    push("Elimination tree: parent of j is the first later vertex reachable through earlier ones.", 0, -1, new Set());

    const ufParent = Array.from({ length: n }, (_v, i) => i);
    const find = (x: number): number => {
        let root = x;
        while (ufParent[root] !== root) {
            root = ufParent[root] as number;
        }
        while (ufParent[x] !== x) {
            const next = ufParent[x] as number;
            ufParent[x] = root;
            x = next;
        }
        return root;
    };
    const union = (a: number, b: number): void => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) {
            ufParent[rb] = ra;
        }
    };

    for (let j = 0; j < n; j += 1) {
        for (const u of neighbors[j] ?? []) {
            if (u < j) {
                union(j, u);
            }
        }
        const componentRoot = find(j);
        const component = new Set<number>();
        for (let u = 0; u <= j; u += 1) {
            if (find(u) === componentRoot) {
                component.add(u);
            }
        }
        let best = -1;
        for (const u of component) {
            for (const k of neighbors[u] ?? []) {
                if (k > j && (best === -1 || k < best)) {
                    best = k;
                }
            }
        }
        if (best !== -1) {
            parent[j] = best;
            treeEdges.push([j, best]);
        }
        push(
            best === -1
                ? `Vertex ${labels[j]} is a root of the elimination tree.`
                : `Parent of ${labels[j]} is ${labels[best]}, the smallest later neighbor of its component.`,
            4,
            j,
            component,
        );
    }

    push(`Elimination tree complete with ${treeEdges.length} edge(s).`, 7, -1, new Set());

    for (const frame of frames) {
        yield frame;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When a pivot j is eliminated, the fill it creates connects j to the first later vertex that is already tied to it through earlier vertices. That vertex becomes j's parent. The resulting tree tells a sparse solver which columns must wait for which others, which is the basis for supernodal and parallel factorization.",
        invariants: [
            "Every parent index is either -1 or strictly larger than the child index.",
            "The tree has exactly one root and V - 1 edges.",
            "Two vertices share a parent only when they lie in the same component of the induced subgraph.",
        ],
        correctness:
            "At the moment vertex j is processed, the union-find connects exactly the vertices reachable from j through vertices of index at most j, which is the component used in the elimination-tree definition. A later vertex k is the parent precisely when some vertex of that component is adjacent to k, and taking the smallest such k matches the definition of the Cholesky fill parent. Vertices with no such neighbor are roots.",
        complexityRationale:
            "For each of the V vertices the code unions its earlier neighbors and then scans all active vertices and their neighbors, costing O(V (V + E)) worst case. The graph, union-find arrays, and tree edges occupy O(V + E) space.",
        uses: [
            "Scheduling columns of a sparse Cholesky factorization",
            "Building supernodes and elimination-tree-based parallel solvers",
            "Analyzing fill dependency in circuit and finite-element matrices",
        ],
        references: [
            "George and Liu, Computer Solution of Large Sparse Positive Definite Systems, 1981",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on matrix operations",
        ],
        workedExample:
            "For the triangle A-B, B-C, A-C with order A, B, C, vertex A's component is just A and its smallest later neighbor is B, so parent(A)=B. Vertex B's component is A and B, whose smallest later neighbor is C, so parent(B)=C. Vertex C has no later neighbor and becomes the root, giving the tree C to B to A.",
    },
    id: "elimination-tree",
    name: "Elimination Tree",
    category: "graph",
    complexity: { time: "O(V * (V + E))", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "D"],
            C: ["A", "D", "E"],
            D: ["B", "C"],
            E: ["C"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "order vertices and store symmetric adjacency by index",
        "initialize every parent to none and start an empty union-find",
        "for each vertex j from first to last",
        "activate j and union it with each earlier neighbor",
        "find the component of j among vertices up to j",
        "set parent of j to the smallest later neighbor of that component",
        "if no such neighbor exists, mark j as a root",
        "report the parent array and edge count",
    ],
};

export default module;

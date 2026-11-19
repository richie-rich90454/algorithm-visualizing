/**
 * spqr-tree-ds.ts - SPQR Tree Decomposition (S and P reduction, exact)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The SPQR tree decomposes a biconnected graph into a tree of series, parallel,
 * and rigid components. For a two-terminal series-parallel graph the rigid
 * components are absent, and the whole tree can be built by repeatedly applying
 * two local reductions: merge parallel edges into a P node and contract a degree
 * two internal vertex into an S node. Each original edge is a leaf, and the
 * resulting tree supports dynamic queries such as the number of simple
 * source-to-sink paths.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an exact decomposition for small undirected two-terminal
 * series-parallel graphs with at most eight vertices. Graphs containing a
 * triconnected block need R nodes and are reported as not reducible; the rigid
 * case is intentionally out of scope. All edges are treated as distinct even
 * when they join the same pair of vertices.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(E * (V + E)) for the reduction passes on small inputs
 *   Space: O(E + V) for the edges and the decomposition tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes and edges show the current reduced two-terminal graph.
 *   - Each reduction highlights the newly created edge.
 *   - The final frame shows the S/P tree with its leaves and path count.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface GraphEdge {
    id: string;
    u: string;
    v: string;
}

interface TreeNode {
    kind: "leaf" | "S" | "P";
    children: string[];
}

interface SpqrInput {
    edges?: Array<[string, string]>;
    s?: string;
    t?: string;
}

function pairKey(u: string, v: string): string {
    return u < v ? `${u}|${v}` : `${v}|${u}`;
}

function graphEntities(
    edges: GraphEdge[],
    s: string,
    t: string,
    highlight: string,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const vertices = new Set<string>();
    for (const edge of edges) {
        vertices.add(edge.u);
        vertices.add(edge.v);
    }
    vertices.add(s);
    vertices.add(t);
    const entities = [...vertices].map((vertex) => ({
        id: `node-${vertex}`,
        type: "node" as const,
        label: vertex,
        value: vertex,
        state: (vertex === s || vertex === t ? "sorted" : "idle") as VisualEntity["state"],
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { terminal: vertex === s || vertex === t },
    }));
    const visualEdges = edges.map((edge) => ({
        id: `edge-${edge.id}`,
        sourceId: `node-${edge.u}`,
        targetId: `node-${edge.v}`,
        label: edge.id,
        state: (edge.id === highlight ? "active" : "idle") as VisualEdge["state"],
        directed: false,
    }));
    return { entities, edges: visualEdges };
}

function treeEntities(
    nodes: Map<string, TreeNode>,
    root: string,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entries = [...nodes.entries()];
    const entities = entries.map(([id, node], index) => ({
        id: `tnode-${id}`,
        type: "node" as const,
        label: node.kind === "leaf" ? id : node.kind,
        value: node.kind,
        state: (id === root ? "sorted" : "visited") as VisualEntity["state"],
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { kind: node.kind, index, parentId: id === root ? "root" : "" },
    }));
    const edges: VisualEdge[] = [];
    for (const [id, node] of entries) {
        for (const child of node.children) {
            edges.push({
                id: `tedge-${id}-${child}`,
                sourceId: `tnode-${id}`,
                targetId: `tnode-${child}`,
                label: "",
                state: "path" as VisualEdge["state"],
                directed: false,
            });
        }
    }
    return { entities, edges };
}

/** Count paths represented by a decomposition node. */
function countPaths(id: string, nodes: Map<string, TreeNode>): number {
    const node = nodes.get(id);
    if (!node) {
        return 0;
    }
    if (node.kind === "leaf") {
        return 1;
    }
    const values = node.children.map((child) => countPaths(child, nodes));
    if (node.kind === "P") {
        return values.reduce((sum, value) => sum + value, 0);
    }
    return values.reduce((product, value) => product * value, 1);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SpqrInput | null) ?? {};
    const raw = task.edges ?? [
        ["A", "B"],
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
        ["C", "D"],
        ["D", "F"],
    ];
    const s = task.s ?? "A";
    const t = task.t ?? "F";

    let edges: GraphEdge[] = raw.slice(0, 40).map(([u, v], index) => ({ id: `e${index}`, u, v }));
    const nodes = new Map<string, TreeNode>();
    for (const edge of edges) {
        nodes.set(edge.id, { kind: "leaf", children: [] });
    }
    let counter = 0;
    let complete = false;

    let step = 0;
    const initial = graphEntities(edges, s, t, "");
    yield {
        stepNumber: step,
        entities: initial.entities,
        edges: initial.edges,
        description: `Build the S/P tree for a two-terminal graph with ${edges.length} distinct edges from ${s} to ${t}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { edges: edges.length, reductions: 0, s, t, complete: false },
    };
    step += 1;

    while (edges.length > 1 && step < 80) {
        let highlight = "";
        let reduced = false;

        // Parallel reduction: combine every edge between one vertex pair.
        const groups = new Map<string, GraphEdge[]>();
        for (const edge of edges) {
            const key = pairKey(edge.u, edge.v);
            const group = groups.get(key) ?? [];
            group.push(edge);
            groups.set(key, group);
        }
        for (const group of groups.values()) {
            if (group.length < 2) {
                continue;
            }
            const id = `P${counter}`;
            counter += 1;
            nodes.set(id, { kind: "P", children: group.map((edge) => edge.id) });
            const first = group[0];
            edges = edges.filter((edge) => !group.some((g) => g.id === edge.id));
            if (first) {
                edges.push({ id, u: first.u, v: first.v });
            }
            highlight = id;
            reduced = true;
            break;
        }

        // Series reduction: contract a non-terminal vertex of degree two.
        if (!reduced) {
            const degree = new Map<string, number>();
            for (const edge of edges) {
                degree.set(edge.u, (degree.get(edge.u) ?? 0) + 1);
                degree.set(edge.v, (degree.get(edge.v) ?? 0) + 1);
            }
            for (const [vertex, deg] of degree) {
                if (deg !== 2 || vertex === s || vertex === t) {
                    continue;
                }
                const incident = edges.filter((edge) => edge.u === vertex || edge.v === vertex);
                const first = incident[0];
                const second = incident[1];
                if (!first || !second) {
                    continue;
                }
                const a = first.u === vertex ? first.v : first.u;
                const b = second.u === vertex ? second.v : second.u;
                if (a === b) {
                    continue;
                }
                const id = `S${counter}`;
                counter += 1;
                nodes.set(id, { kind: "S", children: [first.id, second.id] });
                edges = edges.filter((edge) => edge.id !== first.id && edge.id !== second.id);
                edges.push({ id, u: a, v: b });
                highlight = id;
                reduced = true;
                break;
            }
        }

        if (!reduced) {
            break;
        }

        const current = graphEntities(edges, s, t, highlight);
        yield {
            stepNumber: step,
            entities: current.entities,
            edges: current.edges,
            description: `Reduction ${counter}: ${highlight.startsWith("P") ? "merge parallel edges" : "contract a degree-two vertex"} into node ${highlight}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { edges: edges.length, reductions: counter, s, t, last: highlight, complete: false },
        };
        step += 1;
    }

    complete = edges.length === 1;
    const root = edges[0]?.id ?? "";
    const pathCount = complete ? countPaths(root, nodes) : 0;
    const tree = treeEntities(nodes, root);
    yield {
        stepNumber: step,
        entities: tree.entities,
        edges: tree.edges,
        description: complete
            ? `SP tree complete with root ${root}; the tree represents ${pathCount} simple ${s}-to-${t} paths.`
            : `The graph is not series-parallel within the S/P model; rigid R nodes would be required.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: {
            edges: edges.length,
            reductions: counter,
            s,
            t,
            complete: complete ? 1 : 0,
            pathCount,
            treeNodes: nodes.size,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A two-terminal network built only by putting edges in series or in parallel has a compact tree description. A parallel group becomes a P node whose value is the sum of its children, and a series chain becomes an S node whose value is the product of its children. Peeling those structures off the graph leaves one edge that is the root of the tree, and queries such as counting paths become a bottom-up evaluation of sums and products.",
        invariants: [
            "Every reduction replaces a subgraph by one edge that represents exactly the same two-terminal behavior.",
            "Each original edge is represented by a leaf somewhere in the decomposition tree.",
            "At an S node the represented path count is the product of the children; at a P node it is the sum.",
        ],
        correctness:
            "Parallel edges between the same pair offer independent alternatives, so the number of source-to-sink paths through them is the sum of the child counts, which is what a P node computes. A degree-two internal vertex forces any path through one incident edge to continue through the other, so the counts multiply, which is what an S node computes. Repeatedly applying these two sound reductions preserves the two-terminal path count until one edge remains, and evaluating the tree bottom up yields the same count as enumerating simple paths in the original graph. A graph that cannot be reduced this way contains a triconnected block and needs an R node, which this implementation reports instead of answering incorrectly.",
        complexityRationale:
            "Each reduction scans the edge list to find a parallel group or a degree-two vertex, costing O(E) work plus vertex degree bookkeeping, and at most E reductions occur, giving O(E * (V + E)) time. The edge list and decomposition tree use O(E + V) space.",
        uses: [
            "Computing reliability and path counts of series-parallel networks",
            "Efficient reachability queries in two-terminal circuit analysis",
            "A stepping stone to full SPQR decomposition of biconnected graphs",
        ],
        references: [
            "Tarjan, Data Structures and Network Algorithms (1983), Chapter 6",
            "Dinic, Algorithm for Solution of a Problem of Maximum Flow (1970)",
        ],
        workedExample:
            "Take edges A-B twice, B-C, C-D twice, and D-F from source A to sink F. Merging the two A-B edges gives a P node worth two paths, contracting B gives an S node worth two, merging the two C-D edges gives a P node worth two, and contracting C and then D multiplies to four. The original graph also has exactly four simple A-to-F paths, confirming the tree value.",
    },
    id: "spqr-tree-ds",
    name: "SPQR Tree (Series-Parallel Reduction)",
    category: "data-structures",
    complexity: { time: "O(E * (V + E))", space: "O(E + V)" },
    defaultInput: {
        edges: [
            ["A", "B"],
            ["A", "B"],
            ["B", "C"],
            ["C", "D"],
            ["C", "D"],
            ["D", "F"],
        ],
        s: "A",
        t: "F",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "list the distinct edges and mark the two terminals",
        "create a leaf node in the tree for each original edge",
        "while more than one edge remains",
        "merge a parallel group of edges into a new P node",
        "otherwise contract a degree-two internal vertex into an S node",
        "record the new edge and repeat until one edge is left",
        "evaluate the tree by summing at P nodes and multiplying at S nodes",
        "report the root and the number of source-to-sink paths",
    ],
};

export default module;

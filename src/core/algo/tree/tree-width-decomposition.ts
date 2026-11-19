/**
 * tree-width-decomposition.ts - Exact Treewidth by Elimination Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A tree decomposition groups vertices into bags arranged as a tree so that
 * every vertex and edge is covered and each vertex appears in a connected
 * subtree of bags. Its width is the largest bag size minus one, and the
 * smallest achievable width is the treewidth. Eliminating vertices one at a
 * time creates one bag per vertex from that vertex and its current neighbors,
 * adding fill-in edges among the neighbors. Trying every elimination order
 * yields an exact, if exponential, treewidth and a valid decomposition.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n! * n^2) for all elimination orders on n vertices
 *   Space: O(n^2) for the working graph and the resulting bags
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The input graph is drawn with nodes and edges.
 *   - Each elimination step highlights the bag in the working graph.
 *   - The final frame shows the bag tree with its width.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface DecompositionInput {
    vertices?: string[];
    edges?: Array<[string, string]>;
    parentMap?: Record<string, string | null>;
    ids?: string[];
}

interface EliminationStep {
    vertex: string;
    bag: string[];
    width: number;
}

/** All permutations of the given vertex list. */
function permutations(values: string[]): string[][] {
    if (values.length <= 1) {
        return [values];
    }
    const result: string[][] = [];
    for (let i = 0; i < values.length; i += 1) {
        const rest = values.filter((_, index) => index !== i);
        for (const tail of permutations(rest)) {
            result.push([values[i] as string, ...tail]);
        }
    }
    return result;
}

/** Original graph entities for the working-graph frames. */
function graphEntities(
    vertices: string[],
    edges: Array<[string, string]>,
    bag: Set<string>,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = vertices.map((label) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: bag.has(label) ? ("comparing" as EntityState) : ("unvisited" as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: vertices.indexOf(label) },
    }));
    const edgeSet = new Set(edges.map(([a, b]) => [a, b].sort().join("|")));
    const result: VisualEdge[] = [...edgeSet].map((key) => {
        const [a, b] = key.split("|") as [string, string];
        return {
            id: `edge-${a}-${b}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: "idle" as EntityState,
            directed: false,
        };
    });
    return { entities, edges: result };
}

/** The exact treewidth generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DecompositionInput | null) ?? {};
    let vertices: string[];
    let edges: Array<[string, string]>;
    if (Array.isArray(task.vertices) && Array.isArray(task.edges)) {
        vertices = task.vertices.map(String);
        edges = task.edges.map(([a, b]) => [String(a), String(b)]);
    } else {
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
        vertices = task.ids ?? ["A", "B", "C", "D", "E", "F", "G"];
        edges = [];
        for (const [child, parent] of parentMap) {
            if (parent && vertices.includes(child) && vertices.includes(parent)) {
                edges.push([parent, child]);
            }
        }
    }
    vertices = [...new Set(vertices)];
    edges = edges.filter(([a, b]) => a !== b && vertices.includes(a) && vertices.includes(b));

    const initial = graphEntities(vertices, edges, new Set());
    yield {
        stepNumber: 0,
        entities: initial.entities,
        edges: initial.edges,
        description: `Finding an exact tree decomposition for ${vertices.length} vertices by elimination search.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {
            vertices: vertices.length,
            edges: edges.length,
            treewidth: -1,
            order: [] as string[],
            bags: [] as string[],
            width: -1,
        },
    };

    let step = 1;
    if (vertices.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Empty graph has an empty decomposition of width zero.",
            codeLineNumber: 6,
            layout: "graph",
            meta: { vertices: 0, edges: 0, treewidth: 0, order: [] as string[], bags: [] as string[], width: -1 },
        };
        return;
    }

    let bestOrder: string[] = [];
    let bestSteps: EliminationStep[] = [];
    let bestWidth = Infinity;

    for (const order of permutations(vertices)) {
        const adjacency = new Map<string, Set<string>>();
        for (const vertex of vertices) {
            adjacency.set(vertex, new Set<string>());
        }
        for (const [a, b] of edges) {
            adjacency.get(a)?.add(b);
            adjacency.get(b)?.add(a);
        }
        const steps: EliminationStep[] = [];
        let width = -1;
        for (const vertex of order) {
            const neighbors = [...(adjacency.get(vertex) ?? [])].sort();
            const bag = [vertex, ...neighbors].sort();
            width = Math.max(width, bag.length - 1);
            steps.push({ vertex, bag, width });
            for (const a of neighbors) {
                for (const b of neighbors) {
                    if (a !== b) {
                        adjacency.get(a)?.add(b);
                        adjacency.get(b)?.add(a);
                    }
                }
            }
            for (const neighbor of neighbors) {
                adjacency.get(neighbor)?.delete(vertex);
            }
            adjacency.get(vertex)?.clear();
        }
        if (width < bestWidth) {
            bestWidth = width;
            bestOrder = order;
            bestSteps = steps;
        }
    }

    for (let i = 0; i < bestSteps.length; i += 1) {
        const current = bestSteps[i] as EliminationStep;
        const frameGraph = graphEntities(vertices, edges, new Set(current.bag));
        yield {
            stepNumber: step,
            entities: frameGraph.entities,
            edges: frameGraph.edges,
            description: `Eliminate ${current.vertex}: bag [${current.bag.join(", ")}], width so far ${current.width}.`,
            codeLineNumber: i + 1 === bestSteps.length ? 4 : 2,
            layout: "graph",
            meta: {
                vertices: vertices.length,
                edges: edges.length,
                treewidth: -1,
                order: bestOrder.slice(0, i + 1),
                bags: bestSteps.slice(0, i + 1).map((item) => item.bag.join(",")),
                width: current.width,
            },
        };
        step += 1;
    }

    const bagLabels = bestSteps.map((item, index) => `B${index}`);
    const bagEntities: VisualEntity[] = bestSteps.map((item, index) => ({
        id: `bag-${index}`,
        type: "node" as const,
        label: `${bagLabels[index]}:{${item.bag.join(",")}}`,
        value: item.bag.join(","),
        state: "sorted" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, bag: item.bag.join(",") },
    }));
    const bagEdges: VisualEdge[] = [];
    for (let i = 0; i < bestSteps.length; i += 1) {
        const item = bestSteps[i] as EliminationStep;
        const parentIndex = bestSteps.findIndex((other, j) => j > i && item.bag.includes(other.vertex));
        if (parentIndex >= 0) {
            bagEdges.push({
                id: `tree-${i}-${parentIndex}`,
                sourceId: `bag-${i}`,
                targetId: `bag-${parentIndex}`,
                label: item.vertex,
                state: "path" as EntityState,
                directed: false,
            });
        }
    }

    yield {
        stepNumber: step,
        entities: bagEntities,
        edges: bagEdges,
        description: `Exact treewidth ${bestWidth}; ${bagEntities.length} bags connected as a decomposition tree.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            vertices: vertices.length,
            edges: edges.length,
            treewidth: bestWidth,
            order: bestOrder,
            bags: bestSteps.map((item) => item.bag.join(",")),
            width: bestWidth,
            done: true,
        },
    };
}

/** The tree-width decomposition module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A tree decomposition replaces a graph by a tree of overlapping bags. The bags must cover every vertex and edge, and all bags containing a given vertex must form a connected subtree. Eliminating a vertex produces one bag from the vertex and its neighbors; adding fill-in edges among those neighbors makes the construction valid. Searching all elimination orders gives the smallest possible maximum bag size.",
        invariants: [
            "Each eliminated vertex appears in the bag created at its own step.",
            "Fill-in edges make the later neighbors of an eliminated vertex a clique.",
            "Every original edge is contained in at least one bag.",
        ],
        correctness:
            "At elimination time a bag contains the vertex and all its remaining neighbors, and filling in edges among those neighbors makes them a clique. Connecting each bag to the earliest later bag that contains the eliminated vertex gives the running intersection property, so bags containing any vertex form a connected subtree. Every original edge survives until one endpoint is eliminated, at which point both endpoints share that bag, so coverage holds. Because every elimination order corresponds to some decomposition and every decomposition can be represented by an order, minimizing over all orders yields the exact treewidth.",
        complexityRationale:
            "There are n factorial elimination orders and each is simulated in O(n^2) time with set operations, giving O(n! n^2) time; this is exact but only practical for tiny graphs. The working adjacency, bags, and decomposition tree use O(n^2) space.",
        uses: [
            "Deciding bounded-width dynamic programming feasibility",
            "Planning efficient inference on graphical models",
            "A reference solver for checking heuristics on small graphs",
        ],
        references: [
            "Robertson and Seymour, Graph Minors II: Algorithmic Aspects of Treewidth, 1986",
            "Kloks, Treewidth: Computations and Approximations, 1994",
        ],
        workedExample:
            "For the path A-B-C, eliminating A gives bag {A,B}, then B gives bag {B,C}, then C gives bag {C}. Every bag has at most two vertices and the bags link A-B to B-C to C, so the width is one, which is the treewidth of every nontrivial tree.",
    },
    id: "tree-width-decomposition",
    name: "Tree-Width Decomposition",
    category: "tree",
    complexity: { time: "O(n! * n^2)", space: "O(n^2)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E" },
        ids: ["A", "B", "C", "D", "E", "F", "G"],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "copy the graph into a mutable adjacency structure",
        "for every ordering of the vertices",
        "eliminate each vertex into a bag with its neighbors",
        "add fill-in edges among those neighbors",
        "track the largest bag size along the way",
        "keep the ordering with the smallest width",
        "done: output the treewidth and the bag tree",
    ],
};

export default module;

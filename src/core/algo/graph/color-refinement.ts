/**
 * color-refinement.ts - Color Refinement (One-Dimensional Weisfeiler-Leman)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Color refinement repeatedly gives each vertex a new color built from its own
 * color and the sorted multiset of its neighbors' colors. Vertices that start
 * equal stay equal, and the partition only ever gets finer. The process stops
 * at a stable partition, which is a cheap isomorphism invariant: isomorphic
 * graphs always end with the same color-class sizes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) per round, at most V rounds
 *   Space: O(V + E) for the adjacency and signature tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Node colors cycle through the palette as refinement splits classes.
 *   - Edges joining vertices in the same current class are highlighted.
 *   - The final frame marks every class with a distinct stable state.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

const PALETTE: EntityState[] = ["unvisited", "active", "comparing", "sorted", "path", "swapped", "highlight", "unvisited"];

function undirected(adjacency: Record<string, string[]>): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    const vertices = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    for (const vertex of vertices) graph.set(vertex, new Set());
    for (const [source, targets] of Object.entries(adjacency)) {
        for (const target of targets) {
            graph.get(source)?.add(target);
            graph.get(target)?.add(source);
        }
    }
    return graph;
}

function refine(graph: Map<string, Set<string>>, colors: number[]): number[] {
    const vertices = [...graph.keys()];
    const signatures = vertices.map((vertex, index) => {
        const neighborColors = [...(graph.get(vertex) ?? [])]
            .map((neighbor) => colors[vertices.indexOf(neighbor)] ?? 0)
            .sort((a, b) => a - b);
        return `${colors[index] ?? 0}|${neighborColors.join(",")}`;
    });
    const canonical = new Map<string, number>();
    return signatures.map((signature) => {
        const existing = canonical.get(signature);
        if (existing !== undefined) return existing;
        const next = canonical.size;
        canonical.set(signature, next);
        return next;
    });
}

function samePartition(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < a.length; j += 1) {
            if ((a[i] === a[j]) !== (b[i] === b[j])) return false;
        }
    }
    return true;
}

function buildEntities(
    vertices: string[],
    graph: Map<string, Set<string>>,
    colors: number[],
): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const nodes = vertices.map((label, index) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: (PALETTE[(colors[index] ?? 0) % PALETTE.length] ?? "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label, color: colors[index] ?? 0 },
    }));
    const edges: VisualEdge[] = [];
    for (let i = 0; i < vertices.length; i += 1) {
        for (let j = i + 1; j < vertices.length; j += 1) {
            const a = vertices[i] ?? "";
            const b = vertices[j] ?? "";
            if (!(graph.get(a)?.has(b) ?? false)) continue;
            edges.push({
                id: `edge-${a}-${b}`,
                sourceId: `node-${a}`,
                targetId: `node-${b}`,
                label: "",
                state: (colors[i] ?? 0) === (colors[j] ?? 0) ? "active" : "idle",
                directed: false,
            });
        }
    }
    return { nodes, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const graph = undirected(task.graph ?? {
        A: ["B"],
        B: ["A", "C"],
        C: ["B", "D"],
        D: ["C"],
    });
    const vertices = [...graph.keys()];
    let step = 0;

    const emit = (
        colors: number[],
        description: string,
        codeLineNumber: number,
        iteration: number,
        stable: boolean,
    ): VisualFrame => {
        const built = buildEntities(vertices, graph, colors);
        return {
            stepNumber: step,
            entities: built.nodes,
            edges: built.edges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: { vertices: vertices.length, edges: built.edges.length, iteration, classes: new Set(colors).size, stable, colors: [...colors] },
        };
    };

    if (vertices.length === 0) {
        yield emit([], "Empty graph - no vertices to refine.", 0, 0, true);
        return;
    }

    let colors = vertices.map(() => 0);
    yield emit(colors, "Start with every vertex in one color class.", 0, 0, false);
    step += 1;

    for (let iteration = 1; iteration <= vertices.length; iteration += 1) {
        const next = refine(graph, colors);
        const stable = samePartition(colors, next);
        colors = next;
        yield emit(
            colors,
            stable
                ? `Round ${iteration}: the partition is stable with ${new Set(colors).size} color classes.`
                : `Round ${iteration}: signatures split the vertices into ${new Set(colors).size} color classes.`,
            stable ? 5 : 3,
            iteration,
            stable,
        );
        step += 1;
        if (stable) break;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two vertices look alike if their own color and the multiset of their neighbors' colors match. Color refinement assigns exactly that pair a signature, then gives equal signatures equal new colors. Each round can only split classes, never merge them, so after at most as many rounds as there are vertices nothing changes.",
        invariants: [
            "Vertices with the same color always have identical color-neighbor signatures.",
            "The color partition only becomes finer from one round to the next.",
            "Graph automorphisms preserve colors at every round.",
        ],
        correctness:
            "The initial uniform coloring is invariant under every automorphism, and refinement is defined purely from neighbor color multisets, so automorphisms preserve colors inductively. Equal signatures are grouped by construction and unequal ones are separated, which makes the returned partition a well-defined isomorphism invariant even though it is not complete.",
        complexityRationale:
            "One round computes a signature from each vertex and its incident edges in O(V+E) and sorts neighbor color lists, with at most V rounds before stabilization, giving O(V*(V+E)) time and O(V+E) space.",
        uses: [
            "Cheap graph-isomorphism preprocessing and candidate pairing",
            "Feature extraction for graph neural networks",
            "Canonical labeling heuristics in chemical graph tools",
        ],
        references: [
            "Weisfeiler and Leman, The Reduction of a Graph to Canonical Form (1968)",
            "Grohe, Descriptive Complexity, Graph Isomorphism and Locality (2017)",
        ],
        workedExample:
            "On a four-cycle A-B-C-D-A every vertex starts color 0. After one round all signatures are 0|0,0 so the graph stays one class. On a path A-B-C-D the two endpoints have signature 0|0 while the middle pair have 0|0,0, splitting the vertices into two classes.",
    },
    id: "color-refinement",
    name: "Color Refinement (1-WL)",
    category: "graph",
    complexity: { time: "O(V * (V + E))", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "give every vertex the same initial color",
        "for each vertex build a signature from its color and sorted neighbor colors",
        "assign equal signatures the same new color",
        "compare the new partition with the previous one",
        "if the partition did not change, stop",
        "otherwise repeat with the new colors",
        "done: report the stable color classes",
    ],
};

export default module;

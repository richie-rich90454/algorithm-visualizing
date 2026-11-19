/**
 * arboricity-algorithm.ts - Nash-Williams Arboricity by Maximum Subgraph Density
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The arboricity of an undirected graph is the fewest forests whose union
 * covers every edge. By the Nash-Williams theorem it equals the maximum, over
 * all vertex subsets S with at least two vertices, of ceil(E(S) / (|S| - 1)),
 * where E(S) counts edges with both endpoints in S. This module evaluates that
 * formula exactly by inspecting every subset, which is practical for small
 * graphs and gives a reference value for larger ones.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^V * (V + E)) enumerating subsets and counting internal edges
 *   Space: O(V + E) for the graph plus the improving-subset snapshots
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are circles; edges are undirected connections.
 *   - The subset under consideration is highlighted; its internal edges glow.
 *   - Each frame records the best density found so far in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface UndirectedEdge {
    id: string;
    a: string;
    b: string;
}

/** Normalize an undirected adjacency list into a deduplicated edge list. */
function buildGraph(adjacency: Record<string, string[]>): { vertices: string[]; edges: UndirectedEdge[] } {
    const vertices = Object.keys(adjacency).sort();
    const seen = new Set<string>();
    const edges: UndirectedEdge[] = [];
    for (const a of vertices) {
        for (const raw of adjacency[a] ?? []) {
            const b = String(raw);
            if (!Object.prototype.hasOwnProperty.call(adjacency, b)) {
                continue;
            }
            const key = [a, b].sort().join("|");
            if (seen.has(key) || a === b) {
                continue;
            }
            seen.add(key);
            edges.push({ id: `edge-${key.replace("|", "-")}`, a, b });
        }
    }
    return { vertices, edges };
}

/** Count edges with both endpoints in a subset (bitmask over sorted vertices). */
function internalEdges(mask: number, vertices: string[], edges: UndirectedEdge[]): number {
    const index = new Map(vertices.map((v, i) => [v, i] as const));
    let count = 0;
    for (const edge of edges) {
        const ia = index.get(edge.a);
        const ib = index.get(edge.b);
        if (ia !== undefined && ib !== undefined && (mask & (1 << ia)) !== 0 && (mask & (1 << ib)) !== 0) {
            count += 1;
        }
    }
    return count;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Record<string, string[]> } | null) ?? {};
    const adjacency = task.adjacency ?? {
        A: ["B", "C"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["B", "C"],
    };
    const { vertices, edges } = buildGraph(adjacency);
    const nodes = makeGraphNodes(vertices);

    const snap = (
        message: string,
        line: number,
        mask: number,
        bestDensity: number,
        bestMask: number,
        considered: number,
        total: number,
    ): VisualFrame => {
        const inSubset = (label: string): boolean => {
            const i = vertices.indexOf(label);
            return i >= 0 && (mask & (1 << i)) !== 0;
        };
        for (const node of nodes) {
            node.state = inSubset(String(node.value)) ? "active" : "unvisited";
        }
        const visualEdges: VisualEdge[] = edges.map((edge) => ({
            id: edge.id,
            sourceId: `node-${edge.a}`,
            targetId: `node-${edge.b}`,
            label: "",
            state: inSubset(edge.a) && inSubset(edge.b) ? "comparing" : "idle",
            directed: false,
        }));
        const bestSubset = vertices.filter((_v, i) => (bestMask & (1 << i)) !== 0);
        return {
            stepNumber: 0,
            entities: nodes.map((node) => ({ ...node })),
            edges: visualEdges,
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                vertexCount: vertices.length,
                edgeCount: edges.length,
                considered,
                totalSubsets: total,
                bestDensity,
                bestSubset,
                subsetSize: vertices.filter((_v, i) => (mask & (1 << i)) !== 0).length,
                arboricity: Math.ceil(bestDensity),
            },
        };
    };

    if (vertices.length < 2 || edges.length === 0) {
        yield {
            ...snap(
                "Fewer than two vertices or no edges: every edge already forms a forest.",
                0,
                0,
                0,
                0,
                0,
                0,
            ),
            stepNumber: 0,
        };
        return;
    }

    const total = (1 << vertices.length) - 1;
    let bestDensity = 0;
    let bestMask = 0;
    const improvements: Array<{ mask: number; density: number }> = [];
    let considered = 0;
    for (let mask = 1; mask <= total; mask += 1) {
        const size = vertices.reduce((acc, _v, i) => acc + ((mask & (1 << i)) !== 0 ? 1 : 0), 0);
        if (size < 2) {
            continue;
        }
        considered += 1;
        const density = internalEdges(mask, vertices, edges) / (size - 1);
        if (density > bestDensity) {
            bestDensity = density;
            bestMask = mask;
            improvements.push({ mask, density });
        }
    }

    let step = 0;
    yield {
        ...snap(
            `Checking Nash-Williams density over ${total} nonempty subsets of ${vertices.length} vertices.`,
            1,
            0,
            0,
            0,
            0,
            total,
        ),
        stepNumber: step,
    };
    step += 1;

    for (const improvement of improvements) {
        const subset = vertices.filter((_v, i) => (improvement.mask & (1 << i)) !== 0);
        yield {
            ...snap(
                `Subset {${subset.join(", ")}} raises the best density to ${improvement.density.toFixed(2)}.`,
                3,
                improvement.mask,
                improvement.density,
                improvement.mask,
                considered,
                total,
            ),
            stepNumber: step,
        };
        step += 1;
    }

    const arboricity = Math.ceil(bestDensity);
    const witness = vertices.filter((_v, i) => (bestMask & (1 << i)) !== 0);
    yield {
        ...snap(
            `Arboricity is ${arboricity}; the densest subset {${witness.join(", ")}} has E/(V-1) = ${bestDensity.toFixed(2)}.`,
            5,
            bestMask,
            bestDensity,
            bestMask,
            considered,
            total,
        ),
        stepNumber: step,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A forest on v vertices has at most v - 1 edges, so any subgraph whose edges outnumber its vertices minus one cannot fit inside a single forest. Nash-Williams proved that these local bottlenecks are the only obstruction: the number of forests needed is exactly the largest edge-per-vertex ratio over all subsets, rounded up.",
        invariants: [
            "The best density never decreases as more subsets are inspected.",
            "A subset with s vertices can contain at most s(s-1)/2 internal edges.",
            "The reported arboricity is the ceiling of the best density found.",
        ],
        correctness:
            "Each forest contributes at most |S| - 1 edges inside any subset S, so covering the graph with k forests forces k at least ceil(E(S)/(|S|-1)) for every S; therefore k must be at least the computed maximum. Nash-Williams' theorem supplies a matching upper bound by showing the edges can always be partitioned into exactly that many forests, so the ceiling of the maximum density is the true arboricity.",
        complexityRationale:
            "There are 2^V subsets and each is scanned against the E edges to count internal edges, giving O(2^V (V + E)) time. Only the graph, the current best subset, and the improving snapshots are retained, so space is O(V + E).",
        uses: [
            "Bounding the number of DFS forests needed in sparse graph algorithms",
            "Analyzing the sparsity of dependency and communication networks",
            "Decomposing a graph into edge-disjoint forests for parallel scheduling",
        ],
        references: [
            "Nash-Williams, Edge-Disjoint Spanning Trees of Finite Graphs, 1961",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on spanning trees",
        ],
        workedExample:
            "For the complete graph on four vertices, the whole vertex set has six edges and three vertices minus one, giving density 6/3 = 2, and no subset is denser. The arboricity is therefore 2, matching the fact that K4 decomposes into two spanning trees.",
    },
    id: "arboricity-algorithm",
    name: "Arboricity via Nash-Williams Density",
    category: "graph",
    complexity: { time: "O(2^V * (V + E))", space: "O(V + E)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D"],
            D: ["B", "C"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the sorted vertex list and deduplicated edge list",
        "initialize best density to zero and best subset to empty",
        "for every nonempty vertex subset S with at least two vertices",
        "count the edges whose two endpoints lie in S",
        "compute the density E(S) divided by |S| minus one",
        "if the density improves, record S and the new best density",
        "after all subsets, round the best density up to an integer",
        "report the arboricity and a densest witness subset",
    ],
};

export default module;

/**
 * quantum-triangle-finding.ts - Quantum Triangle Finding via Wedges
 *
 * A triangle in an undirected graph is a triple of mutually adjacent vertices.
 * The quantum approach searches the space of two-edge paths, called wedges:
 * a center plus two of its neighbors. A wedge is marked when the two arms are
 * also connected, which closes it into a triangle. Amplitude amplification
 * over wedges finds a triangle quadratically faster than checking every wedge.
 *
 * This is an exact small simulation. It enumerates wedges to count marked ones,
 * derives the Grover iteration count and success probability, and reports the
 * first marked wedge as the outcome of a successful measurement. Limits: the
 * graph is a small supplied edge list, and measurement randomness is replaced
 * by choosing a valid marked wedge.
 *
 * Time: O(n^3) enumeration in the simulator; ideal query complexity O(n^(3/2)).
 * Space: O(n^2).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Edge = [number, number];
type Triple = [number, number, number];

function makeEntities(n: number, edges: Edge[], found: Triple | null): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const inTriangle = (v: number) => found !== null && (v === found[0] || v === found[1] || v === found[2]);
    const entities: VisualEntity[] = Array.from({ length: n }, (_, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: `v${index}`,
        value: index,
        state: inTriangle(index) ? ("path" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
    const key = new Map<string, Edge>();
    for (const [u, v] of edges) {
        key.set(`${Math.min(u, v)}-${Math.max(u, v)}`, [u, v]);
    }
    const visualEdges: VisualEdge[] = [...key.values()].map(([u, v], index) => {
        let state: EntityState = "idle";
        if (found) {
            const pairs: Array<[number, number]> = [
                [found[0], found[1]],
                [found[0], found[2]],
                [found[1], found[2]],
            ];
            if (pairs.some(([a, b]) => (a === u && b === v) || (a === v && b === u))) {
                state = "path";
            }
        }
        return {
            id: `edge-${index}`,
            sourceId: `node-${u}`,
            targetId: `node-${v}`,
            label: "",
            state,
            directed: false,
        };
    });
    return { entities, edges: visualEdges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: number; edges?: Edge[] } | null) ?? {};
    const n = Math.max(0, Math.min(12, Math.floor(Number(task.vertices ?? 6)) || 6));
    const edges: Edge[] = task.edges ?? [
        [0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [3, 4], [4, 5], [3, 5],
    ];
    const adjacency: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
    for (const [u, v] of edges) {
        if (u >= 0 && u < n && v >= 0 && v < n && u !== v) {
            (adjacency[u] as boolean[])[v] = true;
            (adjacency[v] as boolean[])[u] = true;
        }
    }
    let step = 0;
    const empty = makeEntities(n, edges, null);

    yield {
        stepNumber: step,
        entities: empty.entities,
        edges: empty.edges,
        description: `Search a ${n}-vertex graph for a triangle using quantum wedge amplification.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { vertices: n, edgeCount: edges.length },
    };
    step += 1;

    // A wedge is a triple i < j < k with edges (i,j) and (i,k) present.
    const wedges: Triple[] = [];
    const triangles: Triple[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            if (!(adjacency[i] as boolean[])[j]) {
                continue;
            }
            for (let k = j + 1; k < n; k += 1) {
                if (!(adjacency[i] as boolean[])[k]) {
                    continue;
                }
                const triple: Triple = [i, j, k];
                wedges.push(triple);
                if ((adjacency[j] as boolean[])[k]) {
                    triangles.push(triple);
                }
            }
        }
    }
    const wedgeSpace = wedges.length;
    const marked = triangles.length;
    yield {
        stepNumber: step,
        entities: empty.entities,
        edges: empty.edges,
        description: `Oracle marks ${marked} wedge(s) that close into a triangle among ${wedgeSpace} wedges.`,
        codeLineNumber: 2,
        layout: "graph",
        meta: { wedgeSpace, marked, triangles },
    };
    step += 1;

    if (marked === 0) {
        yield {
            stepNumber: step,
            entities: empty.entities,
            edges: empty.edges,
            description: "No wedge closes into a triangle, so the graph is triangle-free.",
            codeLineNumber: 6,
            layout: "graph",
            meta: { found: false, wedgeSpace, marked: 0 },
        };
        return;
    }

    const sinTheta = Math.sqrt(marked / wedgeSpace);
    const iterations = Math.max(0, Math.floor((Math.PI / (4 * sinTheta)) - 0.5));
    const angle = (2 * iterations + 1) * Math.asin(Math.min(1, sinTheta));
    const probability = Math.min(1, Math.sin(angle) ** 2);
    yield {
        stepNumber: step,
        entities: empty.entities,
        edges: empty.edges,
        description: `Grover applies ${iterations} iteration(s), giving success probability ${(probability * 100).toFixed(1)} percent.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { iterations, sinTheta, probability },
    };
    step += 1;

    const triangle = triangles[0] as Triple;
    const found = makeEntities(n, edges, triangle);
    yield {
        stepNumber: step,
        entities: found.entities,
        edges: found.edges,
        description: `Measured triangle on vertices ${triangle[0]}, ${triangle[1]} and ${triangle[2]}.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            found: true,
            triangle,
            wedgeSpace,
            marked,
            iterations,
            probability,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A wedge is two edges that meet at a vertex. If the two outer ends are also joined, the wedge closes into a triangle. Instead of testing every triple of vertices, the quantum method treats each wedge as a search item and amplifies the rare marked wedges that are actual triangles. A measurement then returns one of them.",
        invariants: [
            "Every wedge uses three distinct vertices with i less than j less than k.",
            "A wedge is marked exactly when its outer pair has an edge.",
            "The marked count equals the number of distinct triangles in the graph.",
        ],
        correctness:
            "By enumerating wedges with the center as the smallest index, each triangle is represented exactly once, so the marked set is in one-to-one correspondence with triangles. Amplitude amplification with k iterations yields success probability sin squared of (2k+1) theta where sin squared theta is the marked fraction; the simulator computes k and the probability exactly and returns only a marked wedge, which by construction is a genuine triangle.",
        complexityRationale:
            "The simulator scans all vertex triples once, costing O(n^3) time and O(n^2) space for adjacency. The ideal quantum algorithm needs O(n^(3/2)) queries because it searches on the order of n^3 wedges with a quadratic speedup.",
        uses: [
            "Counting motifs in social and biological networks",
            "Triangle detection as a subroutine in graph clustering",
            "Testing transitivity and clustering coefficients",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 6",
            "Magniez, Santha and Xiao, Quantum Algorithms for the Triangle Problem, SIAM 2007",
        ],
        workedExample:
            "On vertices 0 through 3 with edges 0-1, 0-2, 1-2, 1-3 and 2-3, the wedges are (0,1,2) and (1,2,3). Both have their outer pair joined, so both are marked and the measurement may return either triangle, for example 0, 1, 2.",
    },
    id: "quantum-triangle-finding",
    name: "Quantum Triangle Finding",
    category: "quantum",
    complexity: { time: "O(n^3) simulator / O(n^(3/2)) queries", space: "O(n^2)" },
    defaultInput: {
        vertices: 6,
        edges: [
            [0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [3, 4], [4, 5], [3, 5],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read the vertex count and edge list",
        "build an adjacency matrix for the graph",
        "enumerate wedges with the smallest vertex as center",
        "mark a wedge when its two arms are adjacent",
        "if nothing is marked report that the graph is triangle-free",
        "compute the Grover count from the marked fraction",
        "amplify and measure a marked wedge to output a triangle",
    ],
};

export default module;

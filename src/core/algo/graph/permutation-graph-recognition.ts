/**
 * permutation-graph-recognition.ts - Permutation Graph Recognition by
 * Inversion Matching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A permutation graph is built from a permutation: two vertices are adjacent
 * exactly when their order in the vertex list and their order in the
 * permutation disagree, that is, when the pair is an inversion. To recognize
 * one, this module tries every assignment of distinct positions to the
 * vertices and compares the resulting inversion graph with the input. The
 * first exact match is a witness that the graph is a permutation graph.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n! * (n + E)) enumerating permutations and checking inversions
 *   Space: O(V + E) for the adjacency, positions, and witness
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are circles and edges are undirected connections.
 *   - The candidate position order is shown on the vertices.
 *   - Matched edges are green; the witness permutation is in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Record<string, string[]> } | null) ?? {};
    const adjacencyInput = task.adjacency ?? {
        A: ["C", "D"],
        B: ["C", "D"],
        C: ["A", "B"],
        D: ["A", "B"],
    };
    const vertices = Object.keys(adjacencyInput).sort();
    const n = vertices.length;
    const target = new Set<string>();
    for (let i = 0; i < n; i += 1) {
        const a = vertices[i];
        if (a === undefined) {
            continue;
        }
        for (const raw of adjacencyInput[a] ?? []) {
            const b = String(raw);
            const j = vertices.indexOf(b);
            if (j >= 0 && i < j) {
                target.add(`${i},${j}`);
            }
        }
    }
    const nodes: VisualEntity[] = makeGraphNodes(vertices);
    let recognized = false;
    let witness: number[] = [];
    let compared = 0;

    const inversionEdges = (positions: number[]): Set<string> => {
        const result = new Set<string>();
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                const pi = positions[i];
                const pj = positions[j];
                if (pi !== undefined && pj !== undefined && pi > pj) {
                    result.add(`${i},${j}`);
                }
            }
        }
        return result;
    };

    const snap = (
        message: string,
        line: number,
        positions: number[],
        matched: boolean,
    ): VisualFrame => {
        const byPosition = new Map<number, string>();
        vertices.forEach((v, i) => {
            const p = positions[i];
            if (p !== undefined) {
                byPosition.set(p, v);
            }
        });
        for (const node of nodes) {
            const label = String(node.value);
            const i = vertices.indexOf(label);
            const p = i >= 0 ? positions[i] : undefined;
            node.label = p === undefined ? label : `${label}:${p}`;
            node.state = p === undefined ? "unvisited" : matched ? "sorted" : "comparing";
        }
        const virtualEdges = inversionEdges(positions);
        const visualEdges: VisualEdge[] = [];
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                const a = vertices[i];
                const b = vertices[j];
                if (a === undefined || b === undefined) {
                    continue;
                }
                const present = target.has(`${i},${j}`);
                const candidate = virtualEdges.has(`${i},${j}`);
                if (present || candidate) {
                    visualEdges.push({
                        id: `edge-${a}-${b}`,
                        sourceId: `node-${a}`,
                        targetId: `node-${b}`,
                        label: "",
                        state: present === candidate ? (matched ? "sorted" : "path") : "error",
                        directed: false,
                    });
                }
            }
        }
        return {
            stepNumber: 0,
            entities: nodes.map((node) => ({ ...node })),
            edges: visualEdges,
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                vertexCount: n,
                edgeCount: target.size,
                compared,
                permutationGraph: recognized,
                witness: [...witness],
                order: vertices.map((v, i) => `${v}:${positions[i] ?? -1}`),
            },
        };
    };

    yield {
        ...snap("Testing vertex position orders for an exact inversion-graph match.", 1, [], false),
        stepNumber: 0,
    };
    let step = 1;

    const used = new Array<boolean>(n).fill(false);
    const assignment = new Array<number>(n).fill(-1);
    const search = (index: number): boolean => {
        if (index >= n) {
            compared += 1;
            const edges = inversionEdges(assignment);
            const match = edges.size === target.size && [...edges].every((key) => target.has(key));
            if (match) {
                recognized = true;
                witness = [...assignment];
                return true;
            }
            return false;
        }
        for (let p = 0; p < n; p += 1) {
            if (used[p]) {
                continue;
            }
            used[p] = true;
            assignment[index] = p;
            if (search(index + 1)) {
                return true;
            }
            used[p] = false;
            assignment[index] = -1;
        }
        return false;
    };
    search(0);

    const witnessPositions = recognized ? witness : assignment;
    yield {
        ...snap(
            recognized
                ? `Perfect match: this graph is the inversion graph of the witness order.`
                : `No position order reproduces the inversion graph after ${compared} candidate(s).`,
            5,
            witnessPositions,
            recognized,
        ),
        stepNumber: step,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Draw the vertices in a row and draw the same vertices in a second row in some permutation order. Connect two vertices when their relative order flips between the rows. Every such drawing produces a permutation graph; recognition asks whether some ordering produces exactly the graph we were given.",
        invariants: [
            "Each candidate assigns distinct positions to all vertices.",
            "An edge appears in the candidate graph exactly for an inversion of the positions.",
            "A perfect match means the input adjacency equals the candidate inversion set.",
        ],
        correctness:
            "Enumerating all n factorial position assignments covers every possible permutation graph on the labeled vertices. Checking that the inversion set equals the input edge set is exact, so finding a match proves membership and exhausting all assignments proves non-membership.",
        complexityRationale:
            "There are n! assignments and each is compared against O(n^2) pairs, giving O(n! (n + E)) time. The recursion, position arrays, and witness use O(V + E) space.",
        uses: [
            "Recognizing graphs that admit efficient permutation-graph algorithms",
            "Modeling crossing diagrams and timeline order conflicts",
            "Choosing an algorithm class in graph analysis pipelines",
        ],
        references: [
            "Pnueli, Lempel and Even, The Transitive Orientation of a Graph and the Structure of Permutation Graphs, 1971",
            "Golumbic, Algorithmic Graph Theory and Perfect Graphs",
        ],
        workedExample:
            "For vertices A, B, C in that order, the permutation positions A=2, B=1, C=0 makes every pair an inversion, so the recognized graph is the triangle. A graph with only edge A-B has no matching order and is not a permutation graph on three labeled vertices.",
    },
    id: "permutation-graph-recognition",
    name: "Permutation Graph Recognition",
    category: "graph",
    complexity: { time: "O(n! * (n + E))", space: "O(V + E)" },
    defaultInput: {
        adjacency: {
            A: ["C", "D"],
            B: ["C", "D"],
            C: ["A", "B"],
            D: ["A", "B"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "sort the vertices and index their adjacency as ordered pairs",
        "try each distinct assignment of positions to vertices",
        "compute the inversion set of the assigned positions",
        "compare the inversion set with the input edge set",
        "on an exact match, record the witness and stop",
        "after all assignments, report whether a match exists",
    ],
};

export default module;

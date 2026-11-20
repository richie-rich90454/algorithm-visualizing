/**
 * node2vec.ts - Node2vec Biased Random Walks and Embeddings
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Node2vec learns low-dimensional vertex representations by treating random
 * walks as sentences. Its distinguishing feature is a second-order biased
 * walk: with return parameter p and in-out parameter q, a walk leaving the
 * previous vertex is more likely to stay in the same neighborhood when q is
 * small and more likely to explore outward when q is large. Windowed
 * co-occurrence counts then feed a small truncated eigendecomposition that
 * produces the embedding coordinates.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(walkCount * length * degree + n^3) for the dense eigendecomposition
 *   Space: O(n^2) for the co-occurrence matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices on the current walk are GREEN (path); the current vertex is
 *     PINK (highlight).
 *   - Traversed edges are GREEN; other edges stay idle.
 *   - The final frame reports the embedding coordinates for every vertex.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface Node2VecInput {
    graph?: Record<string, string[]>;
    dimensions?: number;
    walkLength?: number;
    walksPerNode?: number;
    window?: number;
    p?: number;
    q?: number;
    seed?: number;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Node2VecInput | null) ?? {};
    const raw: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C"],
        C: ["A", "B", "D", "E"],
        D: ["C"],
        E: ["C", "F", "G", "H"],
        F: ["E", "G"],
        G: ["E", "F"],
        H: ["E"],
    };
    const labels = [...new Set([...Object.keys(raw), ...Object.values(raw).flat()])].sort();
    const adjacency = new Map<string, Set<string>>(labels.map((v) => [v, new Set<string>()]));
    for (const [u, neighbors] of Object.entries(raw)) {
        for (const v of neighbors) {
            adjacency.get(u)?.add(v);
            adjacency.get(v)?.add(u);
        }
    }
    const dimensions = Math.max(1, Math.min(3, typeof task.dimensions === "number" ? task.dimensions : 2));
    const walkLength = Math.max(1, typeof task.walkLength === "number" ? task.walkLength : 8);
    const walksPerNode = Math.max(1, typeof task.walksPerNode === "number" ? task.walksPerNode : 2);
    const window = Math.max(1, typeof task.window === "number" ? task.window : 2);
    const p = typeof task.p === "number" && task.p > 0 ? task.p : 1;
    const q = typeof task.q === "number" && task.q > 0 ? task.q : 1;
    const seed = typeof task.seed === "number" ? task.seed >>> 0 : 2026;
    let rngState = seed || 1;
    const random = (): number => {
        rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
        return rngState / 4294967296;
    };

    const nodes = makeGraphNodes(labels);
    const edges: VisualEdge[] = [];
    for (let i = 0; i < labels.length; i += 1) {
        for (let j = i + 1; j < labels.length; j += 1) {
            const a = labels[i] as string;
            const b = labels[j] as string;
            if (adjacency.get(a)?.has(b)) {
                edges.push({
                    id: `edge-${a}-${b}`,
                    sourceId: `node-${a}`,
                    targetId: `node-${b}`,
                    label: "1",
                    state: "idle",
                    directed: false,
                });
            }
        }
    }

    let step = 0;
    let walkIndex = 0;
    let emitted = 0;
    let bfsSteps = 0;
    let dfsSteps = 0;
    let returnSteps = 0;
    const walks: string[] = [];
    const MAX_FRAMES = 220;

    const frame = (
        description: string,
        codeLineNumber: number,
        path: string[],
        current: string,
        extra: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => {
        const pathSet = new Set(path);
        const pathEdges = new Set<string>();
        for (let i = 1; i < path.length; i += 1) {
            pathEdges.add(`${path[i - 1]}-${path[i]}`);
        }
        return {
            stepNumber: step,
            entities: nodes.map((node) => {
                const label = node.label;
                let state: EntityState = pathSet.has(label) ? "path" : "unvisited";
                if (label === current) {
                    state = "highlight";
                }
                return { ...node, state };
            }),
            edges: edges.map((edge) => {
                const source = edge.sourceId.replace("node-", "");
                const target = edge.targetId.replace("node-", "");
                return {
                    ...edge,
                    state: pathEdges.has(`${source}-${target}`) ? "path" : "idle",
                };
            }),
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                walkIndex,
                walk: path.join("-"),
                p,
                q,
                dimensions,
                walksGenerated: walks.length,
                bfsSteps,
                dfsSteps,
                returnSteps,
                ...extra,
            },
        };
    };

    yield frame(`Node2vec on ${labels.length} vertex(es) with p=${p}, q=${q} and ${dimensions} embedding dimension(s).`, 0, [], "", { seed });
    step += 1;

    const co = labels.map(() => labels.map(() => 0));
    for (const start of labels) {
        for (let w = 0; w < walksPerNode; w += 1) {
            const path: string[] = [start];
            let previous = "";
            for (let position = 1; position < walkLength; position += 1) {
                const current = path[path.length - 1] as string;
                const neighbors = [...(adjacency.get(current) ?? [])].sort();
                if (neighbors.length === 0) {
                    break;
                }
                const weights = neighbors.map((x) => {
                    if (previous && x === previous) {
                        return 1 / p;
                    }
                    if (previous && adjacency.get(previous)?.has(x)) {
                        return 1;
                    }
                    if (previous) {
                        return 1 / q;
                    }
                    return 1;
                });
                const total = weights.reduce((sum, value) => sum + value, 0);
                let ticket = random() * total;
                let chosen = neighbors[neighbors.length - 1] as string;
                for (let i = 0; i < neighbors.length; i += 1) {
                    ticket -= weights[i] as number;
                    if (ticket <= 0) {
                        chosen = neighbors[i] as string;
                        break;
                    }
                }
                if (previous) {
                    if (chosen === previous) {
                        returnSteps += 1;
                    } else if (adjacency.get(previous)?.has(chosen)) {
                        bfsSteps += 1;
                    } else {
                        dfsSteps += 1;
                    }
                }
                path.push(chosen);
                previous = current;
                if (emitted < MAX_FRAMES) {
                    const walkFrame = frame(
                        `Walk ${walkIndex + 1} from ${start}: ${current} -> ${chosen}; ${previous} was the previous vertex.`,
                        3,
                        path,
                        chosen,
                    );
                    walkFrame.stepNumber = step;
                    yield walkFrame;
                    step += 1;
                    emitted += 1;
                }
            }
            walks.push(path.join("-"));
            walkIndex += 1;
            for (let i = 0; i < path.length; i += 1) {
                for (let j = i + 1; j < path.length && j - i <= window; j += 1) {
                    const a = labels.indexOf(path[i] as string);
                    const b = labels.indexOf(path[j] as string);
                    if (a >= 0 && b >= 0) {
                        if (a === b) {
                            continue;
                        }
                        co[a][b] = (co[a][b] as number) + 1;
                        co[b][a] = (co[b][a] as number) + 1;
                    }
                }
            }
        }
    }

    const matrix = co.map((row) => [...row]);
    const embedding: number[] = [];
    for (let k = 0; k < dimensions; k += 1) {
        let vector = labels.map((_, i) => Math.cos((i + 1) * (k + 1) * 0.7) + 0.01);
        for (let iteration = 0; iteration < 40; iteration += 1) {
            const next = matrix.map((row) => row.reduce((sum, value, j) => sum + value * (vector[j] as number), 0));
            const norm = Math.sqrt(next.reduce((sum, value) => sum + value * value, 0));
            if (norm < 1e-12) {
                break;
            }
            vector = next.map((value) => value / norm);
        }
        const lambda = vector.reduce(
            (sum, vi, i) => sum + vi * ((matrix[i] ?? []).reduce((inner, value, j) => inner + value * (vector[j] as number), 0)),
            0,
        );
        for (const value of vector) {
            embedding.push(value);
        }
        for (let i = 0; i < labels.length; i += 1) {
            for (let j = 0; j < labels.length; j += 1) {
                matrix[i][j] = (matrix[i][j] as number) - lambda * (vector[i] as number) * (vector[j] as number);
            }
        }
    }

    const final = frame(
        `Generated ${walks.length} walk(s); embedding coordinates for ${labels.length} vertex(es) in ${dimensions} dimension(s).`,
        6,
        [],
        "",
        { embedding, walks: walks.length, done: true },
    );
    final.stepNumber = step;
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Node2vec turns a graph into a corpus by walking it, then treats vertices like words. The walk is biased: a small q keeps it near the previous vertex, producing breadth-first neighborhoods, while a large q pushes it outward, producing depth-first exploration. Counting which vertices co-occur inside a short window and factorizing that matrix gives each vertex a compact vector.",
        invariants: [
            "Every step of a walk moves to an actual neighbor of the current vertex.",
            "The return weight is 1/p, same-neighborhood weight is 1, and outward weight is 1/q.",
            "The co-occurrence matrix is symmetric because each windowed pair is counted in both directions.",
        ],
        correctness:
            "The biased walker is a Markov chain on directed edges whose transition probabilities are the normalized weights, so each generated walk obeys the node2vec search bias. Windowed counts are a symmetric positive matrix; truncated power iteration with deflation extracts its leading eigenvectors, which are the coordinates that best preserve co-occurrence under a linear model.",
        complexityRationale:
            "Generating walks costs O(walkCount times length times average degree). Building co-occurrences costs O(walkCount times length times window), and the dense eigenstep costs O(n^3) for small graphs, giving the stated bound. The co-occurrence matrix needs O(n^2) space.",
        uses: [
            "Learning vertex features for link prediction and node classification",
            "Graph visualization and clustering from compact embeddings",
            "A drop-in feature extractor for downstream machine learning on networks",
        ],
        references: [
            "Grover and Leskovec, node2vec: Scalable Feature Learning for Networks, KDD 2016",
            "Mikolov et al., Efficient Estimation of Word Representations in Vector Space, 2013",
        ],
        workedExample:
            "On two triangles joined by a bridge edge C to E, a walk that starts at A and moved from B to C will, with small q, prefer A or D because they neighbor the previous vertex B. With large q it more often crosses the bridge to E, so the co-occurrence matrix changes and the learned coordinates reflect a more global view.",
    },
    id: "node2vec",
    name: "Node2vec",
    category: "graph",
    complexity: { time: "O(walks * length * degree + n^3)", space: "O(n^2)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C"],
            C: ["A", "B", "D", "E"],
            D: ["C"],
            E: ["C", "F", "G", "H"],
            F: ["E", "G"],
            G: ["E", "F"],
            H: ["E"],
        },
        dimensions: 2,
        walkLength: 8,
        walksPerNode: 2,
        window: 2,
        p: 1,
        q: 1,
        seed: 2026,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "symmetrize the graph and initialize an empty co-occurrence matrix",
        "for every vertex generate the requested number of walks",
        "step to a neighbor weighted by return and in-out parameters",
        "count vertex pairs that occur within the context window",
        "after all walks, form the symmetric co-occurrence matrix",
        "extract leading eigenvectors by power iteration with deflation",
        "done: report one embedding vector per vertex",
    ],
};

export default module;

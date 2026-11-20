/**
 * infomap-community.ts - Infomap Community Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Infomap finds communities by minimizing the map equation, the expected
 * number of bits needed to describe where a random walker goes at each step.
 * A short description is possible when the walker stays inside a community
 * for a long time before exiting, so minimizing the map equation naturally
 * groups tightly connected vertices. This module builds a teleported random
 * walk, computes its stationary distribution, and greedily moves vertices
 * between modules while the map equation decreases.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * V * (V + E)) for power iteration and greedy moves
 *   Space: O(V^2) for the transition matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are colored by community (cycling green, path, highlight, visited).
 *   - The vertex being moved is PURPLE (pivot).
 *   - The final frame reports the number of communities and the map equation.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;

function normalize(input: unknown): Adj {
    const raw = (input as { graph?: Adj } | null) ?? {};
    const source: Adj =
        raw.graph && typeof raw.graph === "object"
            ? raw.graph
            : {
                  A: ["B", "C"],
                  B: ["A", "C", "D"],
                  C: ["A", "B"],
                  D: ["B", "E", "F"],
                  E: ["D", "F"],
                  F: ["D", "E"],
              };
    const adj: Adj = {};
    for (const v of Object.keys(source)) {
        adj[v] = [];
    }
    for (const [u, ns] of Object.entries(source)) {
        for (const v of ns) {
            adj[u] ??= [];
            adj[v] ??= [];
            if (!(adj[u] as string[]).includes(v)) {
                (adj[u] as string[]).push(v);
            }
            if (!(adj[v] as string[]).includes(u)) {
                (adj[v] as string[]).push(u);
            }
        }
    }
    return adj;
}

const STATE_CYCLE = ["sorted", "path", "highlight", "visited", "comparing"] as const;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const adj = normalize(input);
    const vertices = Object.keys(adj).sort();
    const n = vertices.length;
    const index = new Map<string, number>(vertices.map((v, i) => [v, i]));
    const deg = vertices.map((v) => (adj[v] ?? []).length);

    const visualEdges: VisualEdge[] = [];
    const seen = new Set<string>();
    for (const [u, ns] of Object.entries(adj)) {
        for (const v of ns) {
            const key = [u, v].sort().join("|");
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            visualEdges.push({
                id: `edge-${u}-${v}`,
                sourceId: `node-${u}`,
                targetId: `node-${v}`,
                label: "",
                state: "idle",
                directed: false,
            });
        }
    }

    function nodesWith(assign: number[], moved: number): VisualEntity[] {
        return makeGraphNodes(vertices).map((node, i) => {
            const module = assign[i] ?? 0;
            const state = i === moved ? "pivot" : STATE_CYCLE[module % STATE_CYCLE.length];
            return {
                ...node,
                label: `${String(node.label)}:${module}`,
                state,
                metadata: { label: String(node.label), module },
            };
        });
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: nodesWith(new Array(n).fill(0), -1),
        edges: visualEdges,
        description: "Infomap greedily minimizes the map equation over a random walk.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { n, modules: 1, mapEquation: "pending" },
    };
    step += 1;

    if (n === 0) {
        yield {
            stepNumber: step,
            entities: nodesWith([], -1),
            edges: visualEdges,
            description: "An empty graph has no communities and zero description length.",
            codeLineNumber: 7,
            layout: "graph",
            meta: { n: 0, modules: 0, mapEquation: 0, communities: [] },
        };
        return;
    }

    // Teleported transition matrix.
    const teleport = 0.15;
    const P: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const walk = (deg[i] as number) > 0 && (adj[vertices[i] as string] ?? []).includes(vertices[j] as string)
                ? 1 / (deg[i] as number)
                : (deg[i] as number) === 0
                  ? 1 / n
                  : 0;
            P[i]![j] = (1 - teleport) * walk + teleport / n;
        }
    }

    // Stationary distribution by power iteration.
    let pi = Array<number>(n).fill(1 / n);
    for (let it = 0; it < 300; it += 1) {
        const next = Array<number>(n).fill(0);
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                next[j] = (next[j] as number) + (pi[i] as number) * (P[i]![j] as number);
            }
        }
        pi = next;
    }

    function mapEquation(assign: number[]): number {
        const mass = new Map<number, number>();
        const exit = new Map<number, number>();
        for (let i = 0; i < n; i += 1) {
            const m = assign[i] as number;
            mass.set(m, (mass.get(m) ?? 0) + (pi[i] as number));
        }
        for (let i = 0; i < n; i += 1) {
            const mi = assign[i] as number;
            for (let j = 0; j < n; j += 1) {
                if (assign[j] !== mi) {
                    exit.set(mi, (exit.get(mi) ?? 0) + (pi[i] as number) * (P[i]![j] as number));
                }
            }
        }
        let totalExit = 0;
        for (const value of exit.values()) {
            totalExit += value;
        }
        let L = 0;
        for (const [m, flow] of exit) {
            if (totalExit > 0 && flow > 0) {
                const f = flow / totalExit;
                L += -flow * Math.log2(f);
            }
            const moduleMass = mass.get(m) ?? 0;
            if (moduleMass > 0) {
                for (let i = 0; i < n; i += 1) {
                    if (assign[i] !== m) {
                        continue;
                    }
                    const p = (pi[i] as number) / moduleMass;
                    if (p > 0) {
                        L += moduleMass * (-p * Math.log2(p));
                    }
                }
            }
        }
        return L;
    }

    let assign = Array.from({ length: n }, (_, i) => i);
    let current = mapEquation(assign);
    const initialLength = current;
    let moves = 0;

    for (let iter = 0; iter < n * 4 && moves < 80; iter += 1) {
        let improved = false;
        for (let i = 0; i < n; i += 1) {
            const options = new Set<number>([assign[i] as number]);
            for (const nb of adj[vertices[i] as string] ?? []) {
                options.add(assign[index.get(nb) as number] as number);
            }
            let bestModule = assign[i] as number;
            let bestLength = current;
            for (const m of options) {
                const trial = [...assign];
                trial[i] = m;
                const value = mapEquation(trial);
                if (value < bestLength - 1e-9) {
                    bestLength = value;
                    bestModule = m;
                }
            }
            if (bestModule !== assign[i]) {
                assign[i] = bestModule;
                current = bestLength;
                improved = true;
                moves += 1;
                yield {
                    stepNumber: step,
                    entities: nodesWith(assign, i),
                    edges: visualEdges,
                    description: `Moved ${vertices[i]} to community ${bestModule}; map equation is now ${current.toFixed(3)} bits.`,
                    codeLineNumber: 4,
                    layout: "graph",
                    meta: { n, moves, mapEquation: current, moved: vertices[i] },
                };
                step += 1;
            }
        }
        if (!improved) {
            break;
        }
    }

    // Renumber communities contiguously.
    const remap = new Map<number, number>();
    const communities = assign.map((m) => {
        if (!remap.has(m)) {
            remap.set(m, remap.size);
        }
        return remap.get(m) as number;
    });
    const moduleCount = remap.size;

    yield {
        stepNumber: step,
        entities: nodesWith(communities, -1),
        edges: visualEdges,
        description: `Found ${moduleCount} community(ies) with a map equation of ${current.toFixed(3)} bits.`,
        codeLineNumber: 7,
        layout: "graph",
        meta: {
            n,
            modules: moduleCount,
            mapEquation: current,
            initialMapEquation: initialLength,
            communities,
            moves,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A random walker tends to bounce around inside a tight cluster and only occasionally escapes to another one. The map equation charges bits for naming the module the walker exits and for naming the node it visits inside a module. If a partition keeps the walker in a module for many steps, the average description gets short, so minimizing those bits reveals the communities.",
        invariants: [
            "The transition matrix is row-stochastic with teleportation, so a stationary distribution exists.",
            "A greedy move is accepted only when it strictly lowers the map equation.",
            "Every vertex stays assigned to exactly one community.",
        ],
        correctness:
            "The map equation is the expected number of bits per step to encode a random walk using a two-level code. Grouping nodes that exchange a lot of walk flow reduces exit-code bits and increases within-node code length only where the walk actually spends time. Greedily accepting only decreasing moves cannot increase the objective, so the algorithm converges to a local minimum that represents a coherent community partition.",
        complexityRationale:
            "Power iteration runs a fixed number of sweeps over the dense transition matrix, O(V^2). Each greedy pass evaluates O(V) candidate moves and each evaluation sums over the matrix, O(V^2), for O(V^3) per pass and O(V^4) in the stated iteration bound; storage is the O(V^2) transition matrix.",
        uses: [
            "Community detection in social and biological networks",
            "Finding functional modules in brain and protein networks",
            "Hierarchical clustering of large information networks",
        ],
        references: [
            "Rosvall and Bergstrom, Maps of Random Walks on Complex Networks Reveal Community Structure, 2008",
            "Rosvall, Axelsson and Bergstrom, The Map Equation, 2009",
        ],
        workedExample:
            "For two triangles joined by a single bridge, a walker crosses the bridge rarely. Assigning each triangle to its own community makes exits rare, shortening the module code, so the map equation prefers the two-community partition over one big community.",
    },
    id: "infomap-community",
    name: "Infomap Community Detection",
    category: "graph",
    complexity: { time: "O(V^4)", space: "O(V^2)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D"],
            B: ["A", "C"],
            C: ["A", "B"],
            D: ["A", "E", "F"],
            E: ["D", "F"],
            F: ["D", "E"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build a teleported random walk over the graph",
        "power-iterate to find the stationary node probabilities",
        "start with every vertex in its own community",
        "compute the map equation for the current partition",
        "for each vertex try moving it to a neighbor's community",
        "accept the move only if the map equation decreases",
        "repeat until no move helps",
        "done: renumber and report the communities",
    ],
};

export default module;

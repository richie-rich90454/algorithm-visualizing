/**
 * welded-tree-algorithm.ts - Continuous-Time Walk on Welded Trees
 *
 * Childs, Farhi, Gutmann and Shor showed that a particle walking coherently on
 * two binary trees joined at their leaves reaches the far side exponentially
 * faster than any classical random walk. This module builds the glued-trees
 * graph, sets up its adjacency Hamiltonian, and evolves an initial state at
 * the entrance with a truncated Taylor series for exp(-i H t).
 *
 * This is an ideal coherent simulation on very small graphs only. The middle
 * matching is the deterministic reversal permutation instead of a fresh random
 * matching, the Hamiltonian is the bare adjacency matrix, and the exponential
 * is truncated after a fixed number of terms. It includes no decoherence,
 * measurement back-action, or hardware noise, and it does not claim the
 * asymptotic speedup for the tiny instances shown here.
 *
 * Time:  O(terms * edges) per sampled time for a sparse graph with few edges per node
 * Space: O(nodes) for the state vector and its working copies
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Complex = [number, number];

interface WeldedInput {
    columns?: number;
    times?: number[];
    terms?: number;
}

/** Build the glued-trees graph: two depth-d binary trees joined by a matching. */
function buildGraph(columns: number) {
    const half = 2 ** (columns + 1) - 1;
    const leftOffset = 1;
    const rightOffset = 1 + half;
    const entrance = 0;
    const exit = rightOffset + half;
    const total = exit + 1;
    const neighbors: number[][] = Array.from({ length: total }, () => []);
    const link = (a: number, b: number) => {
        neighbors[a]?.push(b);
        neighbors[b]?.push(a);
    };
    const nodeAt = (side: "left" | "right", level: number, index: number) =>
        (side === "left" ? leftOffset : rightOffset) + (2 ** level - 1) + index;

    link(entrance, nodeAt("left", 0, 0));
    link(nodeAt("right", 0, 0), exit);
    for (const side of ["left", "right"] as const) {
        for (let level = 0; level < columns; level += 1) {
            for (let j = 0; j < 2 ** level; j += 1) {
                link(nodeAt(side, level, j), nodeAt(side, level + 1, 2 * j));
                link(nodeAt(side, level, j), nodeAt(side, level + 1, 2 * j + 1));
            }
        }
    }
    const leaves = 2 ** columns;
    for (let j = 0; j < leaves; j += 1) {
        link(nodeAt("left", columns, j), nodeAt("right", columns, leaves - 1 - j));
    }
    return { neighbors, entrance, exit, total };
}

/** Apply the sparse adjacency Hamiltonian to a complex state vector. */
function hamiltonian(neighbors: number[][], psi: Complex[]): Complex[] {
    return psi.map((_value, index) => {
        let re = 0;
        let im = 0;
        for (const neighbor of neighbors[index] ?? []) {
            const amp = psi[neighbor] ?? [0, 0];
            re += amp[0];
            im += amp[1];
        }
        return [re, im] as Complex;
    });
}

/** Truncated Taylor expansion of exp(-i H t) applied to the initial state. */
function evolve(neighbors: number[][], initial: Complex[], t: number, terms: number): Complex[] {
    let term = initial.map((z) => [...z] as Complex);
    const result = initial.map((z) => [...z] as Complex);
    for (let k = 1; k <= terms; k += 1) {
        const applied = hamiltonian(neighbors, term);
        const scale = t / k;
        term = applied.map((z) => [z[1] * scale, -z[0] * scale] as Complex);
        for (let i = 0; i < result.length; i += 1) {
            const current = result[i] ?? [0, 0];
            const added = term[i] ?? [0, 0];
            result[i] = [current[0] + added[0], current[1] + added[1]];
        }
    }
    return result;
}

function probabilities(psi: Complex[]): number[] {
    return psi.map((z) => z[0] * z[0] + z[1] * z[1]);
}

function makeBars(probs: number[], exit: number, final: boolean): VisualEntity[] {
    return probs.map((probability, index) => ({
        id: `node-${index}`,
        type: "bar" as const,
        label: `node ${index}: ${probability.toFixed(3)}`,
        value: probability,
        state: final ? "sorted" : index === exit ? "path" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability, role: index === 0 ? "entrance" : index === exit ? "exit" : "tree" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as WeldedInput | null) ?? {};
    const columns = Math.min(3, Math.max(1, Math.floor(Number(task.columns ?? 2)) || 2));
    const terms = Math.min(80, Math.max(10, Math.floor(Number(task.terms ?? 60)) || 60));
    const times = Array.isArray(task.times) && task.times.length > 0
        ? task.times.map((t) => Number(t) || 0).slice(0, 40)
        : [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
    const { neighbors, entrance, exit, total } = buildGraph(columns);
    const initial: Complex[] = Array.from({ length: total }, (_, i) => (i === entrance ? [1, 0] : [0, 0]));

    yield {
        stepNumber: 0,
        entities: makeBars(probabilities(initial), exit, false),
        edges: [],
        description: `Two binary trees of depth ${columns} are welded at their leaves; the walk starts at the entrance.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { columns, nodes: total, time: 0, exitProbability: 0, norm: 1, probabilities: probabilities(initial), times, done: false },
    };

    let step = 1;
    for (let i = 0; i < times.length; i += 1) {
        const t = times[i] ?? 0;
        const state = evolve(neighbors, initial, t, terms);
        const probs = probabilities(state);
        const norm = Math.sqrt(probs.reduce((sum, value) => sum + value, 0));
        const exitProbability = probs[exit] ?? 0;
        yield {
            stepNumber: step,
            entities: makeBars(probs, exit, i === times.length - 1),
            edges: [],
            description: `Time ${t.toFixed(2)}: amplitude spread over ${total} nodes, exit probability ${exitProbability.toFixed(4)}.`,
            codeLineNumber: i === 0 ? 3 : 5,
            layout: "array",
            meta: {
                columns,
                nodes: total,
                time: t,
                exitProbability,
                norm,
                probabilities: probs,
                times,
                done: i === times.length - 1,
            },
        };
        step += 1;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A classical explorer wandering a tree of depth d must backtrack out of many dead-end branches before finding the far root. A quantum particle instead exists in a superposition over all vertices at once, and the different paths interfere. On two trees whose leaves are glued together, the amplitudes cancel on the dead ends and reinforce toward the exit, so the particle is likely to be found on the far side after only polynomially many steps.",
        invariants: [
            "The state vector stays normalized because the adjacency Hamiltonian is Hermitian.",
            "The glued-trees graph is symmetric between its two halves apart from the entrance and exit vertices.",
            "The middle matching is a perfect matching, so every leaf has exactly one partner across the gap.",
        ],
        correctness:
            "The adjacency matrix of an undirected graph is real symmetric, hence Hermitian, so exp(-i H t) is unitary and the total probability stays one. Starting at the entrance, the walk is confined to the connected glued-trees graph. The Taylor series converges to the matrix exponential for bounded H and fixed t, so the computed probabilities approximate the ideal continuous-time quantum walk; the known analysis of the construction shows the exit is reached in polynomial time while a classical walk needs exponential time.",
        complexityRationale:
            "Each Taylor term multiplies the adjacency matrix by a vector in time proportional to the edge count, and the graph has O(nodes) edges because each node has small degree, so a sampled time costs O(terms * nodes). The state vector and its working copy use O(nodes) space.",
        uses: [
            "A teaching example of exponential quantum speedup for graph problems",
            "A benchmark problem for continuous-time quantum walk simulations",
            "Motivation for quantum algorithms on hidden graph structure",
        ],
        references: [
            "Childs, Farhi, Gutmann and Shor, Exponential Algorithmic Speedup by a Quantum Walk, 2003",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 12",
        ],
        workedExample:
            "With one level per tree the graph has eight nodes: an entrance, three nodes on the left tree, a matching between two leaves, three nodes on the right tree, and an exit. Starting at the entrance, the probability at the exit grows as the coherent amplitude spreads through the matching and interferes toward the far root.",
    },
    id: "welded-tree-algorithm",
    name: "Welded Tree Algorithm",
    category: "quantum",
    complexity: { time: "O(terms * nodes)", space: "O(nodes)" },
    defaultInput: { columns: 2, terms: 60, times: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4] },
    visualType: "array",
    run,
    pseudocode: [
        "build two binary trees of depth d and join their leaves with a matching",
        "attach an entrance to the left root and an exit to the right root",
        "place the initial amplitude at the entrance node",
        "form the graph adjacency matrix as the Hamiltonian",
        "for each sampled time compute the Taylor series of exp(-i H t)",
        "apply each series term by multiplying the Hamiltonian with the state",
        "square the amplitudes to obtain node probabilities",
        "report the probability found at the exit node",
    ],
};

export default module;

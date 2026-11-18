/**
 * quantum-approximate-optimization.ts - Quantum Approximate Optimization Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * QAOA approximates the solution of a combinatorial optimization problem by
 * preparing a parameterized quantum state. It starts from the uniform
 * superposition, then alternates a cost phase that rewards good bit strings
 * with a mixer that lets amplitudes flow between bit strings. Measuring the
 * final state gives a distribution whose best outcomes are good solutions.
 *
 * This is a small, exact state-vector simulator for at most five qubits. It
 * carries out the complex amplitude arithmetic of the cost and mixer layers
 * exactly, but it does NOT model noise, decoherence, gate decomposition, or
 * fault tolerance. It is a teaching model whose mathematical step is exact,
 * not a simulation of real quantum hardware.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(layers * N) for N = 2^q basis states
 *   Space: O(N) for the complex state vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per basis state shows its measurement probability.
 *   - The cost layer marks high-cost states; the mixer marks active states.
 *   - The final frame marks the most probable bit string in green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Edge = [number, number];

/** Count cut edges for a basis state (MaxCut cost). */
function costOf(index: number, edges: Edge[]): number {
    let cost = 0;
    for (const [u, v] of edges) {
        if (((index >> u) & 1) !== ((index >> v) & 1)) {
            cost += 1;
        }
    }
    return cost;
}

/** Build the probability bars for every basis state. */
function makeBars(
    probabilities: number[],
    costs: number[],
    bestIndex: number,
    phase: string,
    qubits: number,
): VisualEntity[] {
    const width = Math.max(1, qubits);
    return probabilities.map((probability, index) => {
        let state: EntityState = "idle";
        if (phase === "init" && index === 0) {
            state = "active";
        } else if (phase === "superposition" || phase === "mixer") {
            state = "active";
        } else if (phase === "phase" && (costs[index] ?? 0) > 0) {
            state = "comparing";
        } else if (phase === "done" && index === bestIndex) {
            state = "sorted";
        }
        const bits = index.toString(2).padStart(width, "0");
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${bits}=${probability.toFixed(3)}`,
            value: probability,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, probability, cost: costs[index] ?? 0 },
        };
    });
}

/** The QAOA generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        qubits?: number;
        edges?: Array<[number, number]>;
        gamma?: number;
        beta?: number;
        layers?: number;
    } | null) ?? {};
    const qubits = Math.min(5, Math.max(1, Math.floor(Number(task.qubits ?? 3)) || 3));
    const n = 1 << qubits;
    const gamma = Number.isFinite(Number(task.gamma)) ? Number(task.gamma) : 0.5;
    const beta = Number.isFinite(Number(task.beta)) ? Number(task.beta) : 0.5;
    const layers = Math.min(3, Math.max(1, Math.floor(Number(task.layers ?? 1)) || 1));

    let edges: Edge[] = [];
    if (Array.isArray(task.edges)) {
        for (const candidate of task.edges) {
            if (Array.isArray(candidate) && candidate.length === 2) {
                const u = Math.floor(Number(candidate[0]));
                const v = Math.floor(Number(candidate[1]));
                if (u >= 0 && u < qubits && v >= 0 && v < qubits && u !== v) {
                    edges.push([u, v]);
                }
            }
        }
    }
    if (edges.length === 0) {
        if (qubits >= 3) {
            edges = [[0, 1], [1, 2], [2, 0]];
        } else if (qubits === 2) {
            edges = [[0, 1]];
        }
    }

    const costs: number[] = [];
    let maxCut = 0;
    for (let i = 0; i < n; i += 1) {
        const c = costOf(i, edges);
        costs.push(c);
        if (c > maxCut) {
            maxCut = c;
        }
    }

    const re = new Array<number>(n).fill(0);
    const im = new Array<number>(n).fill(0);
    re[0] = 1;
    const probabilities = (): number[] => re.map((value, i) => value * value + (im[i] ?? 0) ** 2);
    let bestIndex = 0;
    const refreshBest = (): void => {
        const p = probabilities();
        bestIndex = 0;
        for (let i = 1; i < n; i += 1) {
            if ((p[i] ?? 0) > (p[bestIndex] ?? 0)) {
                bestIndex = i;
            }
        }
    };

    let step = 0;
    let gateCount = 0;
    refreshBest();
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(), costs, bestIndex, "init", qubits),
        edges: [],
        description: `Initialize ${qubits} qubits in the |0...0> state for a MaxCut instance with ${edges.length} edge(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { qubits, n, edges: edges.map((e) => `${e[0]}-${e[1]}`), gamma, beta, layers, amplitudesRe: [...re], amplitudesIm: [...im], probabilities: probabilities(), expectedCut: 0, bestIndex, bestCut: costs[bestIndex] ?? 0, maxCut, gateCount },
    };
    step += 1;

    const uniform = 1 / Math.sqrt(n);
    for (let i = 0; i < n; i += 1) {
        re[i] = uniform;
    }
    gateCount += qubits;
    refreshBest();
    yield {
        stepNumber: step,
        entities: makeBars(probabilities(), costs, bestIndex, "superposition", qubits),
        edges: [],
        description: `Hadamard gates create the uniform superposition over all ${n} basis states.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { qubits, n, edges: edges.map((e) => `${e[0]}-${e[1]}`), gamma, beta, layers, amplitudesRe: [...re], amplitudesIm: [...im], probabilities: probabilities(), expectedCut: 0, bestIndex, bestCut: costs[bestIndex] ?? 0, maxCut, gateCount },
    };
    step += 1;

    for (let layer = 0; layer < layers; layer += 1) {
        for (let i = 0; i < n; i += 1) {
            const phase = gamma * (costs[i] ?? 0);
            const cr = Math.cos(phase);
            const ci = -Math.sin(phase);
            const ar = re[i] ?? 0;
            const ai = im[i] ?? 0;
            re[i] = ar * cr - ai * ci;
            im[i] = ar * ci + ai * cr;
        }
        gateCount += edges.length;
        refreshBest();
        yield {
            stepNumber: step,
            entities: makeBars(probabilities(), costs, bestIndex, "phase", qubits),
            edges: [],
            description: `Layer ${layer + 1} cost step: apply the phase exp(-i * gamma * C(z)) to every basis state.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { qubits, n, edges: edges.map((e) => `${e[0]}-${e[1]}`), gamma, beta, layers, layer: layer + 1, amplitudesRe: [...re], amplitudesIm: [...im], probabilities: probabilities(), expectedCut: 0, bestIndex, bestCut: costs[bestIndex] ?? 0, maxCut, gateCount },
        };
        step += 1;

        const cb = Math.cos(beta);
        const sb = Math.sin(beta);
        for (let q = 0; q < qubits; q += 1) {
            const bit = 1 << q;
            for (let i = 0; i < n; i += 1) {
                if ((i & bit) !== 0) {
                    continue;
                }
                const j = i | bit;
                const ar = re[i] ?? 0;
                const ai = im[i] ?? 0;
                const br = re[j] ?? 0;
                const bi = im[j] ?? 0;
                re[i] = cb * ar + sb * bi;
                im[i] = cb * ai - sb * br;
                re[j] = cb * br + sb * ai;
                im[j] = cb * bi - sb * ar;
            }
        }
        gateCount += qubits;
        refreshBest();
        yield {
            stepNumber: step,
            entities: makeBars(probabilities(), costs, bestIndex, "mixer", qubits),
            edges: [],
            description: `Layer ${layer + 1} mixer: rotate each qubit by exp(-i * beta * X) so amplitudes flow between bit strings.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { qubits, n, edges: edges.map((e) => `${e[0]}-${e[1]}`), gamma, beta, layers, layer: layer + 1, amplitudesRe: [...re], amplitudesIm: [...im], probabilities: probabilities(), expectedCut: 0, bestIndex, bestCut: costs[bestIndex] ?? 0, maxCut, gateCount },
        };
        step += 1;
    }

    const p = probabilities();
    let expectedCut = 0;
    for (let i = 0; i < n; i += 1) {
        expectedCut += (p[i] ?? 0) * (costs[i] ?? 0);
    }
    refreshBest();
    const bestBits = bestIndex.toString(2).padStart(qubits, "0");
    yield {
        stepNumber: step,
        entities: makeBars(p, costs, bestIndex, "done", qubits),
        edges: [],
        description: `After ${layers} layer(s), the most likely outcome is ${bestBits} with cut ${costs[bestIndex] ?? 0}; expected cut ${expectedCut.toFixed(3)}. Exact small simulator only; no noise or error correction.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { qubits, n, edges: edges.map((e) => `${e[0]}-${e[1]}`), gamma, beta, layers, amplitudesRe: [...re], amplitudesIm: [...im], probabilities: p, expectedCut, bestIndex, bestBits, bestCut: costs[bestIndex] ?? 0, maxCut, gateCount, note: "exact small state-vector simulator, no hardware noise" },
    };
}

/** The QAOA teaching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "QAOA builds a probability distribution over candidate answers and slowly tilts it toward the good ones. A cost layer adds a phase that depends on how good each bit string is, and a mixer layer lets amplitude move between neighboring bit strings. Repeating the pair of layers concentrates probability on strong solutions, so measuring often returns a good answer.",
        invariants: [
            "The state vector stays normalized: the squared amplitudes sum to one after every layer.",
            "The cost layer only changes phases, so probabilities are unchanged by a single cost step.",
            "The mixer is a product of real rotations, so it preserves the norm of the state.",
        ],
        correctness:
            "The cost operator is diagonal in the computational basis, so multiplying each amplitude by exp(-i times gamma times its cost) is exactly the cost unitary. The mixer exp(-i times beta times X) on each qubit acts on pairs of basis states differing in that qubit by a two-by-two real rotation, which is exactly the mixer unitary. Because the simulator applies the exact matrices to a state vector of size two to the power of q, the probabilities it reports match the mathematical QAOA state for that small system; the approximation quality relative to the true optimum is the variational question the parameters control, not a simulator error.",
        complexityRationale:
            "Each cost or mixer layer visits all N equals two to the power of q amplitudes a constant number of times, so a layer costs O(N) and p layers cost O(p times N). The simulator stores two real arrays of length N, giving O(N) space.",
        uses: [
            "A teaching model for variational quantum optimization",
            "Approximate MaxCut and related combinatorial problems",
            "A concrete example of a parameterized quantum circuit",
        ],
        references: [
            "Farhi, Goldstone, and Gutmann, A Quantum Approximate Optimization Algorithm, 2014",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 4",
        ],
        workedExample:
            "For a three-qubit triangle with one layer and gamma = beta = 0.5, the cost layer phases each of the eight basis states by its cut size and the mixer rotates every qubit. Measuring yields a distribution whose most probable bit string cuts two of the three edges, the true MaxCut, while the exact expected cut tracks the closed-form QAOA value.",
    },
    id: "quantum-approximate-optimization",
    name: "Quantum Approximate Optimization Algorithm (Exact Small Simulator)",
    category: "quantum",
    complexity: { time: "O(layers * N)", space: "O(N)" },
    defaultInput: { qubits: 3, edges: [[0, 1], [1, 2], [2, 0]], gamma: 0.5, beta: 0.5, layers: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "prepare all qubits in the zero state",
        "apply Hadamard gates for the uniform superposition",
        "for each of p layers apply the cost phase exp(-i gamma C(z))",
        "apply the mixer exp(-i beta X) on every qubit",
        "accumulate the probability of each basis state",
        "compute the expected cost of the final distribution",
        "done: report the most probable bit string and expected cost",
    ],
};

export default module;

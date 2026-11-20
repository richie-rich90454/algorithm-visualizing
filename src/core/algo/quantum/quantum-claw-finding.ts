/**
 * quantum-claw-finding.ts - Quantum Claw Finding by Amplitude Amplification
 *
 * Given two functions f and g, a claw is a pair (i, j) with f(i) = g(j).
 * The quantum algorithm places all n squared pairs in uniform superposition,
 * marks the pairs that form a claw with a phase oracle, and applies the
 * Grover diffusion operator. After the optimal number of iterations a
 * measurement returns a claw with high probability, giving a quadratic speedup
 * over checking every pair.
 *
 * Limits of the demo: f and g are explicit lookup tables of power-of-two size
 * at most sixteen entries, the simulation is an ideal pure-state vector with
 * real amplitudes, the number of claws is known to the controller when choosing
 * the iteration count, and there is no noise, decoherence, or measurement
 * back-action beyond the final readout.
 *
 * Time: O(iterations * N) in the simulator, query complexity O(sqrt(N / M)).
 * Space: O(N) for the state vector.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** All pairs (i, j) whose function values agree. */
export function clawPairs(f: number[], g: number[]): Array<[number, number]> {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < f.length; i += 1) {
        for (let j = 0; j < g.length; j += 1) {
            if ((f[i] as number) === (g[j] as number)) {
                pairs.push([i, j]);
            }
        }
    }
    return pairs;
}

/** Ideal amplitude amplification over N basis states with M marked states. */
export function amplify(N: number, markedIndices: number[], iterations: number): number[] {
    const state = new Array<number>(N).fill(1 / Math.sqrt(N));
    for (let k = 0; k < iterations; k += 1) {
        for (const index of markedIndices) {
            state[index] = -(state[index] as number);
        }
        const mean = state.reduce((sum, value) => sum + value, 0) / N;
        for (let i = 0; i < N; i += 1) {
            state[i] = 2 * mean - (state[i] as number);
        }
    }
    return state.map((amplitude) => amplitude * amplitude);
}

function makeBars(probabilities: number[], marked: Set<number>, active: number): VisualEntity[] {
    return probabilities.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: marked.has(index) ? `pair ${index} claw P=${value.toFixed(3)}` : `pair ${index} P=${value.toFixed(3)}`,
        value,
        state: index === active ? "comparing" : marked.has(index) ? "highlight" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: value, marked: marked.has(index) },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { f?: number[]; g?: number[]; iterations?: number } | null) ?? {};
    const f = Array.isArray(task.f) && task.f.length > 0 ? task.f.map(Number) : [0, 1, 2, 3];
    const g = Array.isArray(task.g) && task.g.length > 0 ? task.g.map(Number) : [3, 2, 1, 0];
    const pairs = clawPairs(f, g);
    const N = f.length * g.length;
    const markedIndices = pairs.map(([i, j]) => i * g.length + j);
    const marked = new Set(markedIndices);
    const M = markedIndices.length;
    const optimal = M === 0 || M === N
        ? 0
        : Math.max(1, Math.floor((Math.PI / 4) * Math.sqrt(N / M)));
    const iterations = typeof task.iterations === "number"
        ? Math.max(0, Math.floor(task.iterations))
        : optimal;
    const probabilities = amplify(N, markedIndices, iterations);
    const success = markedIndices.reduce((sum, index) => sum + (probabilities[index] as number), 0);
    let best = 0;
    for (let i = 1; i < N; i += 1) {
        if ((probabilities[i] as number) > (probabilities[best] as number)) {
            best = i;
        }
    }
    const found: [number, number] | null = marked.has(best)
        ? [Math.floor(best / g.length), best % g.length]
        : null;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, marked, -1),
        edges: [],
        description: `Search ${f.length} by ${g.length} pairs for a claw: f(i) equals g(j).`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            f: [...f], g: [...g], pairs, markedIndices, iterations,
            probabilities: [...probabilities], success, found, N, M,
        },
    };
    step += 1;

    for (let k = 0; k < iterations; k += 1) {
        const partial = amplify(N, markedIndices, k + 1);
        const partialSuccess = markedIndices.reduce((sum, index) => sum + (partial[index] as number), 0);
        yield {
            stepNumber: step,
            entities: makeBars(partial, marked, k),
            edges: [],
            description: `Iteration ${k + 1}: marked-pair probability ${partialSuccess.toFixed(5)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                f: [...f], g: [...g], pairs, markedIndices, iterations,
                iteration: k + 1, probabilities: [...partial], success: partialSuccess, N, M,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, marked, -1),
        edges: [],
        description: found
            ? `Claw (${found[0]}, ${found[1]}) found with marked probability ${success.toFixed(5)} after ${iterations} iterations.`
            : `No claw exists among ${N} pairs; marked probability stays zero.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            f: [...f], g: [...g], pairs, markedIndices, iterations,
            probabilities: [...probabilities], success, found, N, M,
            correct: found !== null,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A claw is a matching pair of inputs from two different functions. Classically one tests every pair, costing n squared evaluations. A quantum computer can put all pairs in superposition and flip the phase of the pairs that are claws. Repeated reflections about the marked set and the uniform state rotate amplitude toward those pairs, so a measurement usually returns a claw after only on the order of n queries.",
        invariants: [
            "The state stays normalized because the oracle and diffuser are reflections.",
            "Only claw pairs receive a phase flip from the oracle.",
            "The optimal iteration count scales as the square root of N over M.",
        ],
        correctness:
            "The two operators used are the product of a phase oracle on the marked subspace and the Grover diffusion operator about the uniform state. Their product is a rotation in the span of the uniform marked and uniform unmarked states by twice the arcsine of the square root of M over N. Choosing the number of rotations closest to pi over four times the square root of N over M brings the amplitude of the marked subspace near one, so measuring yields a marked pair with high probability. The classical enumeration of all pairs in the test independently certifies which pairs are claws.",
        complexityRationale:
            "The simulator stores N amplitudes and each oracle or diffusion step touches all N, so the teaching simulation costs O(iterations times N). The algorithm itself needs O(square root of N over M) oracle queries, a quadratic improvement over the N classical pair checks, and O(N) simulator space.",
        uses: [
            "Collision and match detection between two databases",
            "Bases for quantum algorithms on group composition and hidden structure",
            "Verifying equality of functions on large domains",
        ],
        references: [
            "Ambainis, Quantum Walk Algorithm for Element Distinctness, 2007",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, 2010",
        ],
        workedExample:
            "With f = [0,1,2,3] and g = [3,2,1,0] there are four claws, one for each value. Sixteen pairs give N over M equal to four, so two Grover iterations concentrate almost all probability on the four claw pairs and a measurement returns one of them.",
    },
    id: "quantum-claw-finding",
    name: "Quantum Claw Finding",
    category: "quantum",
    complexity: { time: "O(sqrt(N/M)) queries", space: "O(N) simulator" },
    defaultInput: { f: [0, 1, 2, 3], g: [3, 2, 1, 0] },
    visualType: "array",
    run,
    pseudocode: [
        "read the two function lookup tables",
        "list all pairs and mark those that are claws",
        "prepare the uniform superposition over all pairs",
        "apply the phase oracle to marked pairs",
        "apply diffusion about the uniform state",
        "repeat for the optimal number of iterations",
        "measure and check whether the result is a claw",
        "done: report the pair and success probability",
    ],
};

export default module;

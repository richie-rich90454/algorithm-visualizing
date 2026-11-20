/**
 * quantum-pattern-matching.ts - Quantum Pattern Matching by Amplitude Amplification
 *
 * The text is treated as a table of symbols and the pattern as a short query.
 * A basis state names a candidate alignment. A phase oracle marks every
 * alignment where the pattern agrees with the text window, and Grover
 * diffusion amplifies those alignments. A final measurement therefore returns
 * a true match with high probability after roughly the square root of the
 * number of alignments.
 *
 * Limits of the demo: text and pattern are explicit numeric arrays, text length
 * is padded to a power of two at most 256, matching is exact equality of every
 * symbol, the simulation is an ideal pure-state vector, the number of matches
 * is assumed known when setting the iteration count, and no Fourier-based
 * matching or hardware noise is modeled.
 *
 * Time: O(iterations * N) in the simulator, O(sqrt(N/M)) oracle queries.
 * Space: O(N) for the amplitudes.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

/** Every alignment where the pattern equals the text window. */
export function matchPositions(text: number[], pattern: number[]): number[] {
    const found: number[] = [];
    if (pattern.length === 0 || pattern.length > text.length) {
        return found;
    }
    for (let s = 0; s + pattern.length <= text.length; s += 1) {
        let matches = true;
        for (let j = 0; j < pattern.length; j += 1) {
            if ((text[s + j] as number) !== (pattern[j] as number)) {
                matches = false;
                break;
            }
        }
        if (matches) {
            found.push(s);
        }
    }
    return found;
}

function amplitudeAmplify(N: number, marked: number[], iterations: number): number[] {
    const state = new Array<number>(N).fill(1 / Math.sqrt(N));
    for (let k = 0; k < iterations; k += 1) {
        for (const index of marked) {
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
        label: marked.has(index) ? `align ${index} MATCH P=${value.toFixed(3)}` : `align ${index} P=${value.toFixed(3)}`,
        value,
        state: index === active ? "comparing" : marked.has(index) ? "highlight" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability: value, match: marked.has(index) },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: number[]; pattern?: number[]; iterations?: number } | null) ?? {};
    const text = Array.isArray(task.text) && task.text.length > 0
        ? task.text.map(Number)
        : [1, 2, 3, 1, 2, 1, 2, 3];
    const pattern = Array.isArray(task.pattern) && task.pattern.length > 0
        ? task.pattern.map(Number)
        : [1, 2];
    const validPositions = Math.max(0, text.length - pattern.length + 1);
    const matches = matchPositions(text, pattern);
    const N = Math.min(256, 2 ** Math.ceil(Math.log2(Math.max(2, validPositions))));
    const marked = new Set(matches);
    const M = matches.length;
    const optimal = M === 0 ? 0 : Math.max(1, Math.floor((Math.PI / 4) * Math.sqrt(N / M)));
    const iterations = typeof task.iterations === "number"
        ? Math.max(0, Math.floor(task.iterations))
        : optimal;
    const probabilities = amplitudeAmplify(N, matches, iterations);
    const success = matches.reduce((sum, index) => sum + (probabilities[index] as number), 0);
    let best = 0;
    for (let i = 1; i < N; i += 1) {
        if ((probabilities[i] as number) > (probabilities[best] as number)) {
            best = i;
        }
    }
    const found = marked.has(best) ? best : null;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, marked, -1),
        edges: [],
        description: `Search ${validPositions} alignments of a length-${pattern.length} pattern in a length-${text.length} text.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            text: [...text], pattern: [...pattern], matches,
            N, M, iterations, probabilities: [...probabilities], success, found,
        },
    };
    step += 1;

    for (let k = 0; k < iterations; k += 1) {
        const partial = amplitudeAmplify(N, matches, k + 1);
        const partialSuccess = matches.reduce((sum, index) => sum + (partial[index] as number), 0);
        yield {
            stepNumber: step,
            entities: makeBars(partial, marked, k),
            edges: [],
            description: `Grover iteration ${k + 1}: probability of measuring a true match is ${partialSuccess.toFixed(5)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                text: [...text], pattern: [...pattern], matches,
                N, M, iterations, iteration: k + 1,
                probabilities: [...partial], success: partialSuccess,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, marked, -1),
        edges: [],
        description: found === null
            ? "No alignment matches the pattern; the marked subspace stays empty."
            : `Measured alignment ${found}, a true match, with matched probability ${success.toFixed(5)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            text: [...text], pattern: [...pattern], matches,
            N, M, iterations, probabilities: [...probabilities], success, found,
            correct: found !== null,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Pattern matching asks where a short query appears inside a long text. A quantum search treats each possible alignment as a basis state and flips the phase of alignments that match. Repeating the diffusion step pushes amplitude into the matching alignments, so a measurement reveals a true occurrence after about the square root of the number of alignments rather than checking them all.",
        invariants: [
            "The amplitudes remain normalized under the oracle and diffusion reflections.",
            "Exactly the alignments where every pattern symbol agrees receive a phase flip.",
            "The number of iterations is chosen from the known count of matches and alignments.",
        ],
        correctness:
            "The oracle marks exactly the alignments enumerated by direct comparison of every text window with the pattern. Grover iteration rotates the state within the span of the uniform marked and unmarked states, and the chosen number of rotations maximizes the marked amplitude. Therefore a measurement returns an index in the marked set with high probability whenever at least one match exists. The test compares the marked set against an independent exhaustive string comparison.",
        complexityRationale:
            "The simulator applies two full-vector operations per iteration, costing O(iterations times N) time and O(N) space. The abstract query complexity is O(square root of N over M), compared with O(N) alignments scanned classically.",
        uses: [
            "Locating motifs in long genomic sequences",
            "Fast substring search over large immutable corpora",
            "A teaching model for quantum string algorithms",
        ],
        references: [
            "Nielsen and Chuang, Quantum Computation and Quantum Information, 2010",
            "Grover, A Fast Quantum Mechanical Algorithm for Database Search, 1996",
        ],
        workedExample:
            "Searching for the pattern 1,2 in the text 1,2,3,1,2,1,2,3 gives matches at alignments 0, 3 and 5 out of seven alignments. Padding to eight amplitudes and applying a single Grover iteration raises the matched probability above one half, so a measurement typically reports a true occurrence.",
    },
    id: "quantum-pattern-matching",
    name: "Quantum Pattern Matching",
    category: "quantum",
    complexity: { time: "O(sqrt(N/M)) queries", space: "O(N) simulator" },
    defaultInput: { text: [1, 2, 3, 1, 2, 1, 2, 3], pattern: [1, 2] },
    visualType: "array",
    run,
    pseudocode: [
        "read the text and pattern arrays",
        "enumerate every alignment where the pattern fits",
        "mark alignments that equal the pattern window",
        "prepare the uniform superposition over alignments",
        "flip the phase of marked alignments",
        "diffuse about the uniform state for the chosen iterations",
        "measure and test whether the result is a match",
        "done: report the alignment and matched probability",
    ],
};

export default module;

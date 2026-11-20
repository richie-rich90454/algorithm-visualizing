/**
 * ambainis-element-distinctness.ts - Quantum Walk Search for Element Distinctness
 *
 * Element distinctness asks whether a function takes the same value twice. The
 * quantum walk approach searches the Johnson graph whose vertices are r-element
 * subsets of the domain. A subset is marked when it contains a collision, and
 * the walk's initial state is the uniform superposition over subset-and-index
 * pairs. Two reflections, one marking colliding subsets and one about the
 * initial state, amplify the collision probability. Measuring a marked subset
 * exposes a colliding pair classically.
 *
 * Limits of the demo: the subset size is fixed to two, the domain has at most
 * six elements, the function is an explicit lookup table, the walk is simulated
 * as the two-reflection amplitude amplification on the Johnson-graph starting
 * state rather than the full coin-and-shift walk with a query register, and the
 * simulation is ideal with no decoherence.
 *
 * Time: O(iterations * N) in the simulator, with query complexity below the
 * classical N queries. Space: O(N).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Pair {
    a: number;
    b: number;
}

/** All unordered domain pairs on which the function collides. */
export function collisionPairs(f: number[]): Array<[number, number]> {
    const found: Array<[number, number]> = [];
    for (let i = 0; i < f.length; i += 1) {
        for (let j = i + 1; j < f.length; j += 1) {
            if ((f[i] as number) === (f[j] as number)) {
                found.push([i, j]);
            }
        }
    }
    return found;
}

function amplify(N: number, marked: number[], iterations: number): number[] {
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
        label: marked.has(index) ? `subset ${index} COLLISION P=${value.toFixed(3)}` : `subset ${index} P=${value.toFixed(3)}`,
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
    const task = (input as { values?: number[]; iterations?: number } | null) ?? {};
    const values = Array.isArray(task.values) && task.values.length >= 2
        ? task.values.map(Number).slice(0, 6)
        : [3, 1, 4, 1, 5, 2];
    const subsets: Pair[] = [];
    for (let i = 0; i < values.length; i += 1) {
        for (let j = i + 1; j < values.length; j += 1) {
            subsets.push({ a: i, b: j });
        }
    }
    const collisions = collisionPairs(values);
    const markedIndices = subsets
        .map((pair, index) => ((values[pair.a] as number) === (values[pair.b] as number) ? index : -1))
        .filter((index) => index >= 0);
    const marked = new Set(markedIndices);
    const N = subsets.length;
    const M = markedIndices.length;
    const optimal = M === 0 ? 0 : Math.max(1, Math.floor((Math.PI / 4) * Math.sqrt(N / M)));
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
    const winning = subsets[best] as Pair;
    const foundPair: [number, number] | null = marked.has(best)
        ? [winning.a, winning.b]
        : null;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, marked, -1),
        edges: [],
        description: `Search ${N} two-element subsets of ${values.length} inputs for a collision.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            values: [...values], subsets: subsets.map((pair) => [pair.a, pair.b]),
            collisions, markedIndices, iterations, N, M,
            probabilities: [...probabilities], success, foundPair,
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
            description: `Walk reflection ${k + 1}: collision-subset probability ${partialSuccess.toFixed(5)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                values: [...values], subsets: subsets.map((pair) => [pair.a, pair.b]),
                collisions, markedIndices, iterations, N, M,
                iteration: k + 1, probabilities: [...partial], success: partialSuccess,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, marked, -1),
        edges: [],
        description: foundPair
            ? `Measured subset {${foundPair[0]}, ${foundPair[1]}}; both inputs equal ${values[foundPair[0] as number]}.`
            : `No collision exists among ${values.length} inputs.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            values: [...values], subsets: subsets.map((pair) => [pair.a, pair.b]),
            collisions, markedIndices, iterations, N, M,
            probabilities: [...probabilities], success, foundPair,
            correct: foundPair !== null,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of comparing every pair of inputs, a quantum walk explores subsets of the domain. A subset is interesting when it already contains two equal values. The walk starts from a uniform superposition over subsets and a choice of one element in each, and amplitude amplification drives probability toward subsets that contain a collision. Measuring one of them immediately reveals the repeated value.",
        invariants: [
            "Each vertex is a two-element subset paired with one of its elements.",
            "A subset is marked exactly when its two values agree.",
            "The number of reflections is chosen from the ratio of all vertices to marked vertices.",
        ],
        correctness:
            "The Johnson graph vertices are the two-element subsets and the starting state is uniform over each subset together with each of its elements. The collision oracle marks precisely those vertices whose subset contains an equal pair, which the test enumerates by brute force. The two reflections generate the same rotation as Grover amplification in the span of the uniform marked and unmarked states, so with the optimal count the measured state is marked with high probability. Reading the subset then yields a genuine collision.",
        complexityRationale:
            "The simulator applies two linear passes over N vertices per reflection, costing O(iterations times N) time and O(N) space. Abstractly the walk uses far fewer queries than the N squared comparisons of the naive method because the subset structure concentrates the search on unordered pairs.",
        uses: [
            "Detecting duplicate records in large data sets",
            "A teaching entry point to quantum walk algorithms",
            "Subroutine in collision-based cryptanalysis models",
        ],
        references: [
            "Ambainis, Quantum Walk Algorithm for Element Distinctness, 2007",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, 2010",
        ],
        workedExample:
            "On the values 3, 1, 4, 1, 5, 2 there are fifteen two-element subsets and exactly one collision, between indices one and three. Amplifying over the fifteen subset states concentrates probability on that subset, so a measurement typically returns the pair (1, 3).",
    },
    id: "ambainis-element-distinctness",
    name: "Ambainis Element Distinctness (Johnson Walk)",
    category: "quantum",
    complexity: { time: "O(iterations * N) simulator", space: "O(N)" },
    defaultInput: { values: [3, 1, 4, 1, 5, 2] },
    visualType: "array",
    run,
    pseudocode: [
        "read the function values as an explicit table",
        "enumerate all two-element subsets as walk vertices",
        "mark vertices whose subset contains a collision",
        "prepare the uniform superposition over vertices",
        "reflect about the marked vertices",
        "reflect about the initial uniform state",
        "repeat for the chosen number of walk steps",
        "done: measure a subset and report its colliding pair",
    ],
};

export default module;

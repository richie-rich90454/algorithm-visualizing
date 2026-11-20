/**
 * quantum-minimum-finding.ts - Quantum Minimum Finding (Durr-Hoyer, Small Simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quantum minimum finding locates the minimum of an unstructured list using
 * about square root of n evaluations instead of n. It keeps a current best
 * value, marks every entry better than that best, and uses Grover amplitude
 * amplification to sample one of the marked entries. Sampling a better entry
 * improves the best, and the process repeats until no entry is better. Each
 * amplification stage is the quantum subroutine that gives the quadratic speedup.
 *
 * This is a small, ideal state-vector simulation of the amplitude-amplification
 * subroutine with deterministic argmax measurement. It performs the exact
 * Grover iteration arithmetic, but it does NOT model noise, decoherence, gate
 * decomposition, or quantum counting error. It is a teaching model, not
 * quantum hardware execution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * iterations * N) for N = 2^q amplitudes per round
 *   Space: O(N) for the amplitude vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per basis state shows its amplitude in the current amplification.
 *   - Marked entries turn red at the oracle step and green after diffusion.
 *   - meta carries the current best, marked set, iteration count, and success probability.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function nextPowerOfTwo(value: number): number {
    let p = 1;
    while (p < value) {
        p *= 2;
    }
    return p;
}

/** Build amplitude bars, marking the currently better-than-best entries. */
function makeBars(amplitudes: number[], marked: boolean[], phase: string): VisualEntity[] {
    return amplitudes.map((amplitude, index) => {
        let state: EntityState = "idle";
        if (phase === "oracle" && marked[index]) {
            state = "error";
        } else if (phase === "diffusion" && marked[index]) {
            state = "highlight";
        } else if (phase === "measured" && marked[index]) {
            state = "sorted";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${index}:${amplitude.toFixed(3)}${marked[index] ? "*" : ""}`,
            value: amplitude,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, amplitude, marked: marked[index] ?? false },
        };
    });
}

/** The quantum minimum finding generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const raw = Array.isArray(task.values) && task.values.length > 0 ? task.values : [5, 3, 8, 1, 9, 2, 7, 4];
    const values = raw.slice(0, 64).map((v) => Number(v) || 0);
    const n = values.length;
    const N = nextPowerOfTwo(n);
    const uniform = 1 / Math.sqrt(N);

    let bestIndex = 0;
    let bestValue = values[0] ?? 0;
    let step = 0;
    let totalQueries = 0;

    const meta = (phase: string, amplitudes: number[], marked: boolean[], iterations: number, done: boolean) => {
        const successProb = marked.reduce((sum, isMarked, i) => sum + (isMarked ? (amplitudes[i] ?? 0) ** 2 : 0), 0);
        return {
            n,
            N,
            bestIndex,
            bestValue,
            markedCount: marked.filter(Boolean).length,
            iterations,
            totalQueries,
            successProb,
            amplitudes: [...amplitudes],
            probabilities: amplitudes.map((a) => a * a),
            phase,
            done,
            note: "ideal small amplitude-amplification simulator, deterministic measurement, no noise or counting error",
        };
    };

    yield {
        stepNumber: step,
        entities: makeBars(Array.from({ length: N }, (_, i) => (i === 0 ? 1 : 0)), Array.from({ length: N }, () => false), "init"),
        edges: [],
        description: `Find the minimum of ${n} unstructured values with amplitude amplification over N = ${N} basis states.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta("init", Array.from({ length: N }, (_, i) => (i === 0 ? 1 : 0)), Array.from({ length: N }, () => false), 0, false),
    };
    step += 1;

    let rounds = 0;
    while (rounds < n) {
        const marked = Array.from({ length: N }, (_, i) => i < n && (values[i] ?? 0) < bestValue);
        const M = marked.filter(Boolean).length;
        if (M === 0) {
            break;
        }
        rounds += 1;
        const iterations = Math.max(0, Math.floor((Math.PI / 4) * Math.sqrt(N / M)));
        const amplitudes = Array.from({ length: N }, () => uniform);
        totalQueries += iterations;

        yield {
            stepNumber: step,
            entities: makeBars(amplitudes, marked, "setup"),
            edges: [],
            description: `Round ${rounds}: current best is ${bestValue}; ${M} entr${M === 1 ? "y is" : "ies are"} better, so use ${iterations} amplification iteration(s).`,
            codeLineNumber: 2,
            layout: "array",
            meta: meta("setup", amplitudes, marked, iterations, false),
        };
        step += 1;

        for (let k = 0; k < iterations; k += 1) {
            for (let i = 0; i < N; i += 1) {
                if (marked[i]) {
                    amplitudes[i] = -(amplitudes[i] ?? 0);
                }
            }
            yield {
                stepNumber: step,
                entities: makeBars(amplitudes, marked, "oracle"),
                edges: [],
                description: `Iteration ${k + 1}: the oracle flips the sign of each marked amplitude.`,
                codeLineNumber: 4,
                layout: "array",
                meta: meta("oracle", amplitudes, marked, iterations, false),
            };
            step += 1;

            const mean = amplitudes.reduce((sum, a) => sum + a, 0) / N;
            for (let i = 0; i < N; i += 1) {
                amplitudes[i] = 2 * mean - (amplitudes[i] ?? 0);
            }
            yield {
                stepNumber: step,
                entities: makeBars(amplitudes, marked, "diffusion"),
                edges: [],
                description: `Iteration ${k + 1}: diffusion reflects amplitudes about their mean, boosting the marked entries.`,
                codeLineNumber: 5,
                layout: "array",
                meta: meta("diffusion", amplitudes, marked, iterations, false),
            };
            step += 1;
        }

        // Deterministic "measurement": the marked index with the largest amplitude squared.
        let measured = -1;
        let bestProb = -1;
        for (let i = 0; i < N; i += 1) {
            if (marked[i] && (amplitudes[i] ?? 0) ** 2 > bestProb) {
                bestProb = (amplitudes[i] ?? 0) ** 2;
                measured = i;
            }
        }
        if (measured >= 0 && (values[measured] ?? 0) < bestValue) {
            bestIndex = measured;
            bestValue = values[measured] ?? 0;
        } else {
            break;
        }

        yield {
            stepNumber: step,
            entities: makeBars(amplitudes, marked, "measured"),
            edges: [],
            description: `Measurement returns index ${measured} with value ${values[measured]}; the new best is ${bestValue}.`,
            codeLineNumber: 7,
            layout: "array",
            meta: meta("measured", amplitudes, marked, iterations, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(Array.from({ length: N }, (_, i) => (i === bestIndex ? 1 : 0)), Array.from({ length: N }, () => false), "done"),
        edges: [],
        description: `Minimum found: ${bestValue} at index ${bestIndex} after ${rounds} amplification round(s) and ${totalQueries} oracle queries.`,
        codeLineNumber: 7,
        layout: "array",
        meta: meta("done", Array.from({ length: N }, (_, i) => (i === bestIndex ? 1 : 0)), Array.from({ length: N }, () => false), 0, true),
    };
}

/** The quantum minimum finding module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Classical minimum search must look at every entry in the worst case. Quantum minimum finding uses amplitude amplification as a subroutine: mark the entries better than the current best, boost their measurement probability with Grover iterations, and sample one. Each sample that improves the best shrinks the target set, and because amplification needs only about the square root of the list size queries, the whole search gets a quadratic speedup.",
        invariants: [
            "Marked entries are exactly those with value strictly below the current best.",
            "Each Grover iteration is an oracle sign flip followed by reflection about the mean.",
            "Every accepted measurement strictly lowers the current best, so the loop terminates within n rounds.",
        ],
        correctness:
            "For a marked set of size M among N items, Grover amplification after about pi/4 times sqrt(N/M) iterations maps most of the probability mass onto the marked states, so measuring returns a better entry with high probability. Replacing the best with a strictly smaller value preserves the invariant that all marked entries improve the best, and the number of marked entries falls by at least one each round. After at most n rounds no entry is better and the current best is the global minimum.",
        complexityRationale:
            "A round with M marked items uses about sqrt(N/M) iterations, each costing O(N) amplitude updates, and there are O(sqrt(n)) rounds in expectation for the full Durr-Hoyer algorithm. This visualization uses O(N) space for the amplitude vector and reports the exact per-round work in its metadata.",
        uses: [
            "A teaching model for quantum speedups in search problems",
            "The subroutine behind quantum algorithms for optimization",
            "Understanding amplitude amplification as a reusable primitive",
        ],
        references: [
            "Dur and Hoyer, A Quantum Algorithm for Finding the Minimum, 1996",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 6",
        ],
        workedExample:
            "For values [5, 3, 8, 1, 9, 2, 7, 4] with best initially 5, the marked entries are 3, 1, 2, and 4. Amplification boosts those four amplitudes, measurement returns a value below 5 such as 1, and the next round finds no entry below 1, so the minimum 1 is reported.",
    },
    id: "quantum-minimum-finding",
    name: "Quantum Minimum Finding (Small Simulator)",
    category: "quantum",
    complexity: { time: "O(rounds * iterations * N)", space: "O(N)" },
    defaultInput: { values: [5, 3, 8, 1, 9, 2, 7, 4] },
    visualType: "array",
    run,
    pseudocode: [
        "set the current best to the first value",
        "mark every entry whose value is below the current best",
        "start all N amplitudes in an equal superposition",
        "repeat the oracle sign flip and diffusion for the planned iteration count",
        "measure and take the marked entry with the largest probability",
        "if that entry improves the best then adopt it and repeat",
        "stop when no entry is better than the current best",
        "done: report the minimum value and its index",
    ],
};

export default module;

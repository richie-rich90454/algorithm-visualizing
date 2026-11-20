/**
 * amplitude-amplification.ts - Amplitude Amplification (exact small-state simulator)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Amplitude amplification is the generalization of Grover search. Given an
 * oracle that flips the sign of the marked basis states and a diffusion step
 * that reflects amplitudes about their mean, repeated application rotates the
 * state vector toward the marked subspace. For M marked states out of N the
 * marked amplitude after k iterations is sin((2k+1) theta) / sqrt(M), where
 * sin(theta) = sqrt(M/N), giving near-certain measurement at the right k.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is a SMALL EXACT STATE-VECTOR SIMULATOR on real amplitudes, not a
 * fault-tolerant quantum computer. It demonstrates the mathematical rotation
 * of amplitude amplification with N up to a few qubits. Real deployments need
 * quantum gates, error correction, and an actual oracle circuit; nothing here
 * claims physical quantum execution or cryptographic security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) per oracle or diffusion step for an N-state vector
 *   Space: O(N) for the amplitudes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the measurement probability of each basis state.
 *   - Marked states are highlighted after the oracle flips their sign.
 *   - The final frame is green and reports success probability.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(probabilities: number[], marked: Set<number>, state: EntityState): VisualEntity[] {
    return probabilities.map((probability, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(index).padStart(2, "0"),
        value: probability,
        state: marked.has(index) ? (state === "idle" ? "pivot" : state) : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, probability, marked: marked.has(index) },
    }));
}

/** Amplitude amplification generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { states?: number; marked?: number[]; iterations?: number } | null
    ) ?? {};
    const states =
        typeof task.states === "number" && task.states >= 2 && Number.isInteger(Math.log2(task.states))
            ? Math.min(16, Math.max(2, task.states))
            : 4;
    const marked = new Set<number>(
        Array.isArray(task.marked)
            ? task.marked.filter((i) => Number.isInteger(i) && i >= 0 && i < states)
            : [1],
    );
    if (marked.size === 0) marked.add(1 % states);
    const m = marked.size;
    const theta = Math.asin(Math.sqrt(m / states));
    const optimal = Math.max(0, Math.floor(Math.PI / (4 * theta)));
    const requested =
        typeof task.iterations === "number" ? Math.max(0, Math.floor(task.iterations)) : optimal;
    const iterations = Math.max(1, requested);
    const amplitudes = new Array<number>(states).fill(1 / Math.sqrt(states));

    const success = (): number => {
        let total = 0;
        for (const index of marked) total += (amplitudes[index] ?? 0) ** 2;
        return total;
    };
    const meta = (iteration: number, phase: string, done: boolean) => ({
        states,
        marked: [...marked],
        markedCount: m,
        iteration,
        phase,
        amplitudes: [...amplitudes],
        probabilities: amplitudes.map((value) => value ** 2),
        successProbability: success(),
        theta,
        optimalIterations: optimal,
        done,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(amplitudes.map((value) => value ** 2), marked, "idle"),
        edges: [],
        description: `Start with a uniform superposition over ${states} states; ${m} state(s) are marked.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, "initialize", false),
    };
    step += 1;

    for (let k = 1; k <= iterations; k += 1) {
        for (const index of marked) amplitudes[index] = -(amplitudes[index] ?? 0);
        yield {
            stepNumber: step,
            entities: makeBars(amplitudes.map((value) => value ** 2), marked, "pivot"),
            edges: [],
            description: `Iteration ${k} oracle: flip the sign of the ${m} marked amplitude(s).`,
            codeLineNumber: 2,
            layout: "array",
            meta: meta(k, "oracle", false),
        };
        step += 1;

        const mean = amplitudes.reduce((sum, value) => sum + value, 0) / states;
        for (let i = 0; i < states; i += 1) amplitudes[i] = 2 * mean - (amplitudes[i] ?? 0);
        yield {
            stepNumber: step,
            entities: makeBars(amplitudes.map((value) => value ** 2), marked, "comparing"),
            edges: [],
            description: `Iteration ${k} diffusion: reflect every amplitude about the mean; success chance is now ${(success() * 100).toFixed(1)} percent.`,
            codeLineNumber: 3,
            layout: "array",
            meta: meta(k, "diffusion", false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(amplitudes.map((value) => value ** 2), marked, "sorted"),
        edges: [],
        description: `After ${iterations} iteration(s), measuring finds a marked state with probability ${success().toFixed(6)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: meta(iterations, "done", true),
    };
}

/** The amplitude amplification module (exact small-state simulator). */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Flip the sign of the answers you want, then reflect all amplitudes about their average. Those two mirrors together rotate the whole state vector a little toward the marked answers. Repeat a few times and the marked states carry almost all the probability, so a measurement is very likely to return one. The number of repeats is about a quarter of the square root of the search space divided by the number of answers.",
        invariants: [
            "The sum of squared amplitudes stays equal to one after both the oracle and the diffusion step.",
            "The oracle changes only the sign of marked amplitudes, leaving measurement probabilities unchanged at that instant.",
            "The diffusion step replaces each amplitude by twice the mean minus itself, which is a reflection.",
        ],
        correctness:
            "Work in the two-dimensional subspace spanned by the uniform marked state and the uniform unmarked state. Write the initial state as sin(theta) times marked plus cos(theta) times unmarked with sin(theta) equal to the square root of M over N. The oracle and diffusion compose to a rotation by two theta toward the marked direction, so after k iterations the marked component is sin((2k+1) theta). Choosing k near pi over four theta makes that sine close to one, which is the high success probability shown by the simulator.",
        complexityRationale:
            "The oracle touches the marked entries and the diffusion step touches all N amplitudes, so each iteration costs O(N) time on a classical simulator. Keeping the amplitude vector uses O(N) space. On a quantum computer the corresponding oracles and reflections are treated as unitaries; this visualization does not simulate gate-level fault tolerance.",
        uses: [
            "Generalized search when multiple items satisfy a predicate",
            "A subroutine in quantum counting and quantum minimum finding",
            "Amplitude estimation in Monte Carlo speedups",
        ],
        references: [
            "Grover, A Fast Quantum Mechanical Algorithm for Database Search, 1996",
            "Brassard, Hoyer, Mosca, and Tapp, Quantum Amplitude Amplification and Estimation, 2002",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 6",
        ],
        workedExample:
            "With four states and one marked state, sin(theta) is one half and theta is 30 degrees. The initial marked probability is 25 percent. After one oracle flip and one diffusion reflection the marked amplitude becomes one, so measuring returns the marked state with 100 percent probability.",
    },
    id: "amplitude-amplification",
    name: "Amplitude Amplification",
    category: "quantum",
    complexity: { time: "O(N) per iteration (simulator)", space: "O(N)" },
    defaultInput: { states: 4, marked: [1], iterations: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "prepare a uniform superposition over all N states",
        "for each iteration apply the oracle phase flip to marked states",
        "reflect every amplitude about the mean of all amplitudes",
        "the pair of reflections rotates toward the marked subspace",
        "repeat about pi over four theta times",
        "measure: the marked states now hold most of the probability",
        "done: report the success probability",
    ],
};

export default module;

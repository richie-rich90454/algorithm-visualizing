/**
 * fixed-point-amplitude-amplification.ts - Fixed-Point Amplitude Amplification
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ordinary amplitude amplification rotates the state by a fixed angle and
 * overshoots when the fraction of good states is unknown. Fixed-point search
 * uses phase shifts of pi/3 so the deviation from the target is cubed on every
 * iteration: if the bad-state probability is epsilon it becomes epsilon cubed.
 * The good probability therefore rises monotonically toward one and never
 * falls, no matter how the iterations are chosen.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an exact simulation of the two-dimensional good/bad subspace for the
 * phase-pi/3 fixed-point search on at most a handful of qubits. It tracks the
 * subspace amplitudes, not a full gate-level circuit, and models no noise,
 * decoherence, or fault-tolerant error correction. The starting good fraction
 * is given rather than estimated by quantum counting.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations) for the subspace recursion
 *   Space: O(iterations) for the displayed probability history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the good-state probability after each fixed-point iteration.
 *   - The newest bar is yellow; the final frame is green.
 *   - Metadata records the bad probability and its cubic contraction.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(history: number[], active: number, finished: boolean): VisualEntity[] {
    return history.map((probability, index) => {
        const state: EntityState = finished ? "sorted" : index === active ? "comparing" : index < active ? "sorted" : "idle";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `k${index}`,
            value: probability,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, probability, iteration: index },
        };
    });
}

/** Fixed-point amplitude amplification generator (cubic error contraction). */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { goodFraction?: number; iterations?: number } | null) ?? {};
    const good = typeof task.goodFraction === "number" && task.goodFraction > 0 && task.goodFraction < 1
        ? Math.min(0.99, Math.max(0.01, task.goodFraction))
        : 0.25;
    const iterations = typeof task.iterations === "number" && Number.isFinite(task.iterations)
        ? Math.max(1, Math.min(20, Math.floor(task.iterations)))
        : 5;

    const initialBad = 1 - good;
    const badHistory = [initialBad];
    const goodHistory = [good];
    const meta = (step: number, k: number, done: boolean) => {
        const bad = badHistory[badHistory.length - 1] ?? initialBad;
        return {
            goodFraction: good,
            iterations,
            k,
            badProbability: bad,
            goodProbability: 1 - bad,
            contractionFactor: bad === 0 ? 0 : (badHistory[k] ?? initialBad) / (badHistory[Math.max(0, k - 1)] ?? initialBad),
            probabilities: [...goodHistory],
            done,
            step,
        };
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(goodHistory, 0, false),
        edges: [],
        description: `Start with good fraction ${good}; deviation from the target is ${initialBad.toFixed(6)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(step, 0, false),
    };
    step += 1;

    for (let k = 1; k <= iterations; k += 1) {
        const previousBad = badHistory[k - 1] ?? initialBad;
        const nextBad = previousBad ** 3;
        badHistory.push(nextBad);
        goodHistory.push(1 - nextBad);
        yield {
            stepNumber: step,
            entities: makeBars(goodHistory, k, false),
            edges: [],
            description: `Iteration ${k}: bad probability ${previousBad.toExponential(3)} cubed to ${nextBad.toExponential(3)}; good probability is now ${(1 - nextBad).toFixed(8)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: meta(step, k, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(goodHistory, -1, true),
        edges: [],
        description: `After ${iterations} iteration(s) measuring returns good with probability ${(goodHistory[iterations] ?? 1).toFixed(10)}, with no overshoot.`,
        codeLineNumber: 4,
        layout: "array",
        meta: meta(step, iterations, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Grover search keeps rotating past the answer if you run it too long, because the rotation angle is fixed and unknown. Fixed-point search uses phase shifts of one third of pi, which make the small remaining error shrink cubically each round. Shrinking a number below one by cubing it can never make it grow, so the answer gets better and better with no overshoot.",
        invariants: [
            "The bad-state probability after k iterations equals the starting bad probability raised to the power three to the k.",
            "The good and bad probabilities always sum to one.",
            "The good probability is monotone nondecreasing across iterations.",
        ],
        correctness:
            "In the two-dimensional subspace spanned by the good and bad uniform states, the phase-pi/3 fixed-point operator cancels the leading error terms of a standard search step. A state at distance epsilon from the target is mapped to one at distance epsilon cubed, up to higher-order terms that vanish for the ideal operator. Cubing a number in the open interval from zero to one strictly decreases it, so the sequence converges to the target from one side and cannot overshoot. The simulation applies that exact subspace contraction and the closed-form power law verifies it.",
        complexityRationale:
            "Each iteration updates a constant number of subspace values, so the recursion is O(iterations) time. Keeping the probability history for the bars uses O(iterations) space; a physical implementation would use O(log N) qubits and a corresponding number of oracle queries.",
        uses: [
            "Search tasks where the fraction of marked items is unknown",
            "Amplitude estimation routines that must avoid Grover overshoot",
            "A teaching contrast with ordinary amplitude amplification",
        ],
        references: [
            "Yoder, Low, and Chuang, Fixed-Point Quantum Search with an Optimal Number of Queries, 2014",
            "Grover and Rudolph, Creating Superpositions Corresponding to Arbitrary Amplitudes, 2002",
        ],
        workedExample:
            "If a quarter of the states are good, the starting bad probability is 0.75. One fixed-point step cubes it to about 0.4219, so the good probability rises from 0.25 to about 0.578. A second step cubes again to about 0.075, giving a good probability above 0.92. Every later step keeps increasing the good probability, unlike Grover search which would pass the peak and fall.",
    },
    id: "fixed-point-amplitude-amplification",
    name: "Fixed-Point Amplitude Amplification",
    category: "quantum",
    complexity: { time: "O(iterations) subspace steps", space: "O(iterations)" },
    defaultInput: { goodFraction: 0.25, iterations: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "given a lower bound on the good fraction, set the bad probability to one minus it",
        "for each iteration apply the phase-pi/3 fixed-point operator",
        "cube the bad probability to get the next deviation",
        "set the good probability to one minus the bad probability",
        "continue without any dependence on an estimated rotation angle",
        "done: report the good probability with no overshoot",
    ],
};

export default module;

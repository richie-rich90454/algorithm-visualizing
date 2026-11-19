/**
 * probabilistic-error-cancellation.ts - Probabilistic Error Cancellation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Probabilistic error cancellation removes a known noise channel by sampling
 * from a quasi-probability decomposition of its inverse. A depolarizing
 * channel multiplies a Bloch vector by one minus p; its inverse multiplies by
 * 1 over one minus p and can be written as a signed mixture of Pauli gates.
 * Some quasi-probabilities are negative, which is why the sampler uses their
 * absolute values and the estimator carries the sign back as a weight. The
 * weighted average is unbiased: it returns the ideal expectation exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k terms in the quasi-probability decomposition, k = 4 here
 *   Space: O(k) for the decomposition and per-branch records
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid lists the four Pauli branches and the combined estimator row.
 *   - A branch being accumulated is yellow; completed branches are green.
 *   - The final row highlights that the corrected answer equals the ideal one.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Axis = "x" | "y" | "z";
const BRANCHES = ["I", "X", "Y", "Z"];
const AXES: Axis[] = ["x", "y", "z"];

function bloch(axis: Axis): [number, number, number] {
    if (axis === "x") return [1, 0, 0];
    if (axis === "y") return [0, 1, 0];
    return [0, 0, 1];
}

/** Apply a Pauli gate to a Bloch vector, flipping the two axes it anticommutes with. */
function applyPauli(branch: string, v: [number, number, number]): [number, number, number] {
    if (branch === "X") return [v[0], -v[1], -v[2]];
    if (branch === "Y") return [-v[0], v[1], -v[2]];
    if (branch === "Z") return [-v[0], -v[1], v[2]];
    return [v[0], v[1], v[2]];
}

function makeCells(rows: Array<Array<number | string>>, active: number, finished: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const roles = ["branch", "quasiProb", "sampleProb", "weight", "expectation"];
    for (let r = 0; r < rows.length; r += 1) {
        for (let c = 0; c < roles.length; c += 1) {
            const value = rows[r]?.[c] ?? 0;
            const state: EntityState = finished ? "sorted" : r === active ? "comparing" : r < active ? "sorted" : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: typeof value === "string" ? value : value.toFixed(5),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, role: roles[c] ?? "value" },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { p?: number; axis?: string } | null) ?? {};
    const p = typeof task.p === "number" && Number.isFinite(task.p)
        ? Math.max(0, Math.min(0.95, task.p))
        : 0.2;
    const axis: Axis = AXES.includes(task.axis as Axis) ? (task.axis as Axis) : "z";
    const inverseNoise = p >= 1 ? 0 : -p / (1 - p);
    const quasi = [1 - (3 * inverseNoise) / 4, inverseNoise / 4, inverseNoise / 4, inverseNoise / 4];
    const gamma = quasi.reduce((sum, q) => sum + Math.abs(q), 0);
    const sampleProbs = quasi.map((q) => Math.abs(q) / gamma);
    const weights = quasi.map((q) => gamma * (q >= 0 ? 1 : -1));

    const initial = bloch(axis);
    const component = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    const noisyBloch: [number, number, number] = [initial[0] * (1 - p), initial[1] * (1 - p), initial[2] * (1 - p)];
    const noisy = noisyBloch[component];
    const branchExpectations = BRANCHES.map((branch) => applyPauli(branch, noisyBloch)[component]);
    const corrected = quasi.reduce((sum, q, i) => sum + q * (branchExpectations[i] ?? 0), 0);
    const ideal = initial[component];

    const rows: Array<Array<number | string>> = BRANCHES.map((branch, i) => [
        branch,
        quasi[i] ?? 0,
        sampleProbs[i] ?? 0,
        weights[i] ?? 0,
        0,
    ]);
    rows.push(["corrected", 0, 0, 0, 0]);

    const meta = (filled: number, done: boolean) => ({
        p,
        axis,
        inverseNoise,
        gamma,
        quasiProbs: [...quasi],
        sampleProbs: [...sampleProbs],
        weights: [...weights],
        branchExpectations: [...branchExpectations],
        noisy,
        corrected: done ? corrected : 0,
        ideal,
        negativeCount: quasi.filter((q) => q < 0).length,
        filled,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(rows, -1, false),
        edges: [],
        description: `Cancelling depolarizing noise p = ${p.toFixed(3)} on the ${axis} axis with a signed Pauli decomposition.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, false),
    };

    let step = 1;
    for (let i = 0; i < BRANCHES.length; i += 1) {
        rows[i]![4] = branchExpectations[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeCells(rows, i, false),
            edges: [],
            description: `Branch ${BRANCHES[i]}: quasi-probability ${(quasi[i] ?? 0).toFixed(4)}, weight ${(weights[i] ?? 0).toFixed(4)}, branch expectation ${(branchExpectations[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(i + 1, false),
        };
        step += 1;
    }

    rows[BRANCHES.length] = ["corrected", quasi.reduce((s, q) => s + q, 0), 1, 1, corrected];
    yield {
        stepNumber: step,
        entities: makeCells(rows, -1, true),
        edges: [],
        description: `Corrected expectation ${corrected.toFixed(8)} matches the ideal ${ideal.toFixed(8)}; raw noisy value was ${noisy.toFixed(8)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: meta(BRANCHES.length + 1, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If the noise is a known mixture of gates, its inverse is usually a mixture with some negative coefficients. Negative probabilities cannot be sampled directly, so sample each branch with probability proportional to its magnitude and attach a signed weight to the measurement. The sign cancels the over-sampling in expectation, exactly undoing the noise without changing the hardware.",
        invariants: [
            "The four quasi-probabilities sum to one even though some of them are negative.",
            "Sampling uses the absolute quasi-probability divided by the total variation gamma.",
            "The estimator weight is gamma times the sign of the quasi-probability, so each branch contributes its original coefficient in expectation.",
        ],
        correctness:
            "The depolarizing channel sends rho to (1-p) rho plus p I/2, and its inverse sends a Bloch vector r to r over (1-p). Writing that inverse as q_I times the identity channel plus q_X, q_Y, q_Z times Pauli conjugations gives q_I = 1 minus 3p inverse over 4 and q_X = q_Y = q_Z = p inverse over 4 with p inverse = minus p over (1-p). Sampling a branch with probability absolute q over gamma and weighting by gamma sign q makes the expected contribution q times the branch value. Summing branches reproduces the inverse channel applied to the noisy state, which is the ideal state, so the estimator is unbiased.",
        complexityRationale:
            "There are four Pauli branches, each needing one weighted measurement, so time is O(k) with k = 4. Storing the decomposition and branch records is also O(k). On hardware the variance grows with gamma, so more shots are needed as noise increases.",
        uses: [
            "Error mitigation on near-term quantum processors",
            "Accurate energy estimation in variational quantum eigensolvers",
            "Validating noise models against measured circuit outputs",
        ],
        references: [
            "Temme, Bravyi, and Gambetta, Error Mitigation for Short-Depth Quantum Circuits, 2017",
            "Endo et al., Quantum Error Mitigation, Shortcuts and Reviews, 2021",
        ],
        workedExample:
            "With depolarizing p = 0.2 the inverse has p inverse = -0.25, so q_I = 1.1875 and q_X = q_Y = q_Z = -0.0625. Gamma is 1.375. Starting from the Z plus state, the noisy Bloch z is 0.8. Combining 1.1875 times 0.8 with three negative branches returns exactly 1, the ideal Z expectation.",
    },
    id: "probabilistic-error-cancellation",
    name: "Probabilistic Error Cancellation",
    category: "quantum",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { p: 0.2, axis: "z" },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the inverse noise strength from the depolarizing probability",
        "write the inverse channel as signed weights on identity and Pauli gates",
        "set gamma to the sum of absolute weights",
        "sample a branch with probability absolute weight over gamma",
        "measure the observable and multiply by gamma times the weight sign",
        "average the weighted outcomes over all branches",
        "done: report the corrected and noisy expectations",
    ],
};

export default module;

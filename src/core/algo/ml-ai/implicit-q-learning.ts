/**
 * implicit-q-learning.ts - Implicit Q-Learning Expectile Regression
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Implicit Q-Learning avoids querying out-of-distribution actions by fitting
 * a state value as an asymmetric expectile of the next-state Q-values. An
 * expectile generalizes the mean: residuals above the estimate receive weight
 * tau and residuals below receive weight one minus tau. With tau above one
 * half the value tilts toward the best in-data outcomes without ever needing
 * an unseen action, and the result is found by a simple weighted-mean fixed
 * point.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * n) for k fixed-point iterations over n target values
 *   Space: O(n) for the target values and their weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the target Q-values; green bars lie above the current expectile.
 *   - As the fixed point converges the weighting stabilizes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    targets?: number[];
    tau?: number;
    maxIterations?: number;
}

function makeBars(targets: number[], expectile: number, tau: number): VisualEntity[] {
    return targets.map((value, i) => {
        const weight = value > expectile ? tau : 1 - tau;
        return {
            id: `bar-${i}`,
            type: "bar" as const,
            label: `${value.toFixed(2)} (w ${weight.toFixed(2)})`,
            value,
            state: value > expectile ? ("sorted" as EntityState) : ("comparing" as EntityState),
            x: i,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, target: value, weight },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const targets = (task.targets ?? [1, 3, 2, 5, 4]).slice();
    const tau = typeof task.tau === "number" ? Math.min(1, Math.max(0, task.tau)) : 0.7;
    const maxIterations = typeof task.maxIterations === "number" ? Math.max(1, Math.floor(task.maxIterations)) : 20;
    const n = targets.length;
    let expectile = n > 0 ? targets.reduce((a, v) => a + v, 0) / n : 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(targets, expectile, tau),
        edges: [],
        description: `Fit a ${tau.toFixed(2)}-expectile over ${n} in-data Q-values.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: n, tau, expectile: Number(expectile.toFixed(6)), iteration: 0, converged: false },
    };
    step += 1;

    let converged = false;
    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
        let numerator = 0;
        let denominator = 0;
        for (const value of targets) {
            const weight = value > expectile ? tau : 1 - tau;
            numerator += weight * value;
            denominator += weight;
        }
        const next = denominator > 0 ? numerator / denominator : expectile;
        const delta = Math.abs(next - expectile);
        expectile = next;
        converged = delta < 1e-9;
        yield {
            stepNumber: step,
            entities: makeBars(targets, expectile, tau),
            edges: [],
            description: `Iteration ${iteration}: weighted mean gives expectile ${expectile.toFixed(4)} (change ${delta.toExponential(1)}).`,
            codeLineNumber: 3,
            layout: "array",
            meta: { rows: 1, cols: n, tau, expectile: Number(expectile.toFixed(6)), iteration, delta: Number(delta.toExponential(6)), converged },
        };
        step += 1;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(targets, expectile, tau),
        edges: [],
        description: `Done: ${tau.toFixed(2)}-expectile is ${expectile.toFixed(4)}, computed using only in-data Q-values.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { rows: 1, cols: n, tau, expectile: Number(expectile.toFixed(6)), iterations: step - 1, converged },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An expectile is like a weighted mean whose weights depend on which side of the estimate a value falls. Setting tau above one half makes values above the current guess count more, so the estimate drifts upward toward the best outcomes that actually appear in the data. Implicit Q-Learning uses this to extract an optimistic but in-data value without ever evaluating an action the dataset never took.",
        invariants: [
            "Values above the current expectile receive weight tau; values below receive weight 1 - tau.",
            "The next expectile is a weighted average of the target values.",
            "At tau equal to one half, both weights are equal and the expectile is the ordinary mean.",
        ],
        correctness:
            "The fixed-point update sets m to the weighted mean sum(w_i y_i) / sum(w_i) with w_i = tau for y_i above m and 1 - tau otherwise. This is the stationary condition of the asymmetric squared loss rho_tau(u) = |tau - 1(u < 0)| u^2, so iterating it converges to the minimizer. When tau is one half every weight is 0.5 and the minimizer is the arithmetic mean; when tau exceeds one half, values above m dominate and the expectile rises monotonically with tau.",
        complexityRationale:
            "Each fixed-point iteration scans the n targets once to build the numerator and denominator, so k iterations take O(k * n) time; only the target list and a few scalars are stored, giving O(n) space.",
        uses: [
            "Offline reinforcement learning critics",
            "Advantage-weighted regression pipelines",
            "Conservative value estimation from logged outcomes",
        ],
        references: [
            "Kostrikov et al., Offline Reinforcement Learning with Implicit Q-Learning, ICLR 2022",
            "Newey & Powell, Asymmetric Least Squares Estimation, 1987",
        ],
        workedExample:
            "For targets [1, 3, 2, 5, 4] and tau 0.7, the mean 3 is the starting point. Values 3, 5, and 4 get weight 0.7 while 1 and 2 get 0.3, pulling the next estimate above 3. Iteration continues until the weighted mean stops moving near 3.6, well below the extreme value 5 yet tilted upward, and no unseen action was ever queried.",
    },
    id: "implicit-q-learning",
    name: "Implicit Q-Learning",
    category: "ml-ai",
    complexity: { time: "O(k * n)", space: "O(n)" },
    defaultInput: { targets: [1, 3, 2, 5, 4], tau: 0.7, maxIterations: 20 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the expectile to the mean of the targets",
        "repeat until the estimate stops changing",
        "weight each target by tau if above the expectile",
        "otherwise weight the target by one minus tau",
        "set the expectile to the weighted mean of targets",
        "done: return the converged asymmetric expectile",
    ],
};

export default module;

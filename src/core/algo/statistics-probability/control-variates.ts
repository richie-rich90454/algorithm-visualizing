/**
 * control-variates.ts - Control Variates Estimator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Control variates reduce Monte Carlo variance by exploiting a related quantity
 * whose expectation is known exactly. When the control tends to be high the
 * target tends to be high too, so subtracting a multiple of the control's
 * sampling error cancels part of the target's error while keeping the estimate
 * unbiased.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n samples
 *   Space: O(n) for the per-sample rows
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per sample shows u, target f(u), and control g(u).
 *   - The final frame reports the optimal coefficient and both estimates.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    uniforms?: number[];
    controlMean?: number;
}

/** Build the three-column sample grid. */
function makeCells(
    rows: Array<{ u: number; target: number; control: number }>,
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < rows.length; row += 1) {
        const item = rows[row];
        const columns = [item?.u ?? 0, item?.target ?? 0, item?.control ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (done || row < current) state = "sorted";
            else if (row === current) state = "comparing";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: (columns[col] ?? 0).toFixed(3),
                value: columns[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

/** The control-variates generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const uniforms = Array.isArray(task.uniforms) && task.uniforms.length > 1
        ? task.uniforms.map(Number)
        : [0.08, 0.19, 0.31, 0.44, 0.56, 0.69, 0.82, 0.94];
    const controlMean = typeof task.controlMean === "number" ? task.controlMean : 0.5;
    const rows = uniforms.map((u) => ({ u, target: Math.exp(u), control: u }));
    let completed = 0;

    const summary = () => {
        const view = rows.slice(0, completed);
        const targets = view.map((r) => r.target);
        const controls = view.map((r) => r.control);
        const meanT = targets.reduce((s, x) => s + x, 0) / Math.max(1, targets.length);
        const meanC = controls.reduce((s, x) => s + x, 0) / Math.max(1, controls.length);
        let covariance = 0;
        let controlVariance = 0;
        for (let i = 0; i < rows.length; i += 1) {
            covariance += ((targets[i] ?? 0) - meanT) * ((controls[i] ?? 0) - meanC);
            controlVariance += ((controls[i] ?? 0) - meanC) ** 2;
        }
        covariance /= Math.max(1, rows.length);
        controlVariance /= Math.max(1, rows.length);
        const coefficient = controlVariance === 0 ? 0 : covariance / controlVariance;
        const estimate = meanT - coefficient * (meanC - controlMean);
        return {
            rows: rows.length,
            cols: 3,
            n: completed,
            meanTarget: meanT,
            meanControl: meanC,
            controlMean,
            coefficient,
            naiveEstimate: meanT,
            controlledEstimate: estimate,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeCells(rows, completed, false),
        edges: [],
        description: `Control variates on ${uniforms.length} samples with known control mean ${controlMean}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: summary(),
    };
    let step = 1;

    for (let i = 0; i < uniforms.length; i += 1) {
        completed = i + 1;
        const row = rows[i];
        yield {
            stepNumber: step,
            entities: makeCells(rows, completed, false),
            edges: [],
            description: `Sample ${i}: u=${(row?.u ?? 0).toFixed(3)}, target exp(u)=${(row?.target ?? 0).toFixed(3)}, control u=${(row?.control ?? 0).toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: summary(),
        };
        step += 1;
    }

    const final = summary();
    yield {
        stepNumber: step,
        entities: makeCells(rows, completed, true),
        edges: [],
        description: `Optimal coefficient c=${final.coefficient.toFixed(4)}; controlled estimate ${final.controlledEstimate.toFixed(4)} versus naive ${final.naiveEstimate.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: final,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Suppose you are estimating an average but you also have a second number whose true average you already know. If the two move together, then whenever the second number happens to come out high in your sample, the first probably did too. Correcting the first by that known highness cancels noise and gives a steadier estimate.",
        invariants: [
            "The control variable is the uniform draw itself with known mean 0.5.",
            "The optimal coefficient is the sample covariance divided by control variance.",
            "Because the control's true mean is used, the corrected estimator stays unbiased.",
        ],
        correctness:
            "The corrected estimator is mean(f) - c*(mean(g) - E[g]). Since E[mean(g)] equals E[g], its expectation is E[f] for any c, so unbiasedness holds. The variance is Var(f) - 2c*Cov(f,g) + c^2*Var(g), which is minimized at c = Cov(f,g)/Var(g). The generator computes exactly that sample coefficient, so the reported estimate is the minimum-variance member of this family.",
        complexityRationale:
            "Forming the sample means, covariance, and control variance scans the n samples a constant number of times, giving O(n) time. The per-sample grid uses O(n) space.",
        uses: [
            "Monte Carlo option pricing with a similar derivative as control",
            "Reducing simulation noise in reliability engineering",
            "Variance reduction in Markov chain Monte Carlo estimators",
        ],
        references: [
            "Hammersley and Handscomb, Monte Carlo Methods, 1964",
            "Glasserman, Monte Carlo Methods in Financial Engineering, Chapter 4",
        ],
        workedExample:
            "Estimating the mean of exp(U) for uniform U, use g(U)=U with known mean 0.5. With samples 0.1, 0.3, 0.6, 0.9 the target mean is about 1.72 and control mean is 0.475, giving a positive coefficient near 2. Subtracting 2*(0.475-0.5) lifts the estimate slightly toward the true e-1 about 1.718.",
    },
    id: "control-variates",
    name: "Control Variates",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { uniforms: [0.08, 0.19, 0.31, 0.44, 0.56, 0.69, 0.82, 0.94], controlMean: 0.5 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose samples and a control with a known mean",
        "for each uniform draw record the target and control values",
        "compute the sample means of target and control",
        "compute the covariance of target and control",
        "compute the variance of the control",
        "set c to covariance divided by control variance",
        "subtract c times the control's sampling error from the target mean",
        "done: report the coefficient and controlled estimate",
    ],
};

export default module;

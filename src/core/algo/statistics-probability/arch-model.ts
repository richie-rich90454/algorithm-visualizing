/**
 * arch-model.ts - ARCH(q) Autoregressive Conditional Heteroskedasticity
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An ARCH(q) model describes time-varying volatility using only lagged squared
 * shocks. For returns r_t with mean mu, the shock is epsilon_t = r_t - mu and
 * the conditional variance is omega plus a weighted sum of the previous q
 * squared shocks. This is Engle's original model; unlike GARCH it has no lagged
 * variance term. When the alpha weights sum below one, the long-run variance
 * is omega divided by one minus that sum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n q) for n returns and q lags
 *   Space: O(n) for the variance path and displayed cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero of the grid holds the observed returns.
 *   - Row one holds the conditional variance at each time step.
 *   - The active time step is highlighted while the recursion is explained.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface ArchResult {
    returns: number[];
    shocks: number[];
    variances: number[];
    logLikelihood: number;
    persistence: number;
    unconditionalVariance: number;
}

/** Run the ARCH(q) variance recursion over a return series. */
export function archFilter(
    returns: number[],
    mu: number,
    omega: number,
    alphas: number[],
): ArchResult {
    const q = alphas.length;
    const persistence = alphas.reduce((a, b) => a + b, 0);
    const unconditionalVariance = persistence < 1 ? omega / (1 - persistence) : Infinity;
    const shocks: number[] = [];
    const variances: number[] = [];
    let logLikelihood = 0;
    for (let t = 0; t < returns.length; t += 1) {
        const shock = (returns[t] ?? 0) - mu;
        let variance = omega;
        for (let lag = 1; lag <= q; lag += 1) {
            const prior = t - lag >= 0 ? (shocks[t - lag] ?? 0) : 0;
            variance += (alphas[lag - 1] ?? 0) * prior * prior;
        }
        const safeVariance = Math.max(1e-12, variance);
        logLikelihood += -0.5 * (Math.log(2 * Math.PI * safeVariance) + (shock * shock) / safeVariance);
        shocks.push(shock);
        variances.push(variance);
    }
    return { returns: [...returns], shocks, variances, logLikelihood, persistence, unconditionalVariance };
}

function makeCells(result: ArchResult, active: number, done: boolean): VisualEntity[] {
    const n = result.returns.length;
    const cells: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < n; col += 1) {
            const value = row === 0 ? (result.returns[col] ?? 0) : (result.variances[col] ?? 0);
            let state: EntityState = "idle";
            if (done) {
                state = "sorted";
            } else if (col === active) {
                state = "comparing";
            } else if (col < active) {
                state = "visited";
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: row === 0 ? `r=${value.toFixed(3)}` : `s2=${value.toFixed(5)}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, series: row === 0 ? "return" : "variance" },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { returns?: number[]; mu?: number; omega?: number; alphas?: number[] } | null) ?? {};
    const returns = Array.isArray(task.returns) && task.returns.length > 0
        ? task.returns.map((v) => Number(v) || 0)
        : [0.01, -0.02, 0.015, -0.008, 0.02, -0.012, 0.006, -0.004];
    const mu = Number(task.mu ?? 0) || 0;
    const omega = Math.max(1e-9, Number(task.omega ?? 0.0002) || 0.0002);
    const alphasInput = Array.isArray(task.alphas) && task.alphas.length > 0 ? task.alphas : [0.35, 0.25];
    const alphas = alphasInput.map((v) => Math.max(0, Number(v) || 0));
    const result = archFilter(returns, mu, omega, alphas);
    const n = returns.length;

    yield {
        stepNumber: 0,
        entities: makeCells(result, -1, false),
        edges: [],
        description: `ARCH(${alphas.length}) filter on ${n} returns: omega ${omega}, alphas [${alphas.join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 2,
            cols: n,
            mu,
            omega,
            alphas,
            persistence: result.persistence,
            unconditionalVariance: result.unconditionalVariance,
            logLikelihood: 0,
            variances: [],
            phase: "setup",
        },
    };

    let likelihood = 0;
    for (let t = 0; t < n; t += 1) {
        const shock = (returns[t] ?? 0) - mu;
        const variance = result.variances[t] ?? 0;
        const safeVariance = Math.max(1e-12, variance);
        likelihood += -0.5 * (Math.log(2 * Math.PI * safeVariance) + (shock * shock) / safeVariance);
        yield {
            stepNumber: 1 + t,
            entities: makeCells(result, t, false),
            edges: [],
            description: `Step ${t + 1}: shock ${shock.toFixed(5)}, variance = omega + sum of alpha times the previous squared shocks = ${variance.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 2,
                cols: n,
                mu,
                omega,
                alphas,
                persistence: result.persistence,
                unconditionalVariance: result.unconditionalVariance,
                logLikelihood: likelihood,
                variances: result.variances.slice(0, t + 1),
                time: t,
                variance,
                shock,
                phase: "step",
            },
        };
    }

    yield {
        stepNumber: 1 + n,
        entities: makeCells(result, -1, true),
        edges: [],
        description: `Persistence sum alpha = ${result.persistence.toFixed(4)}; long-run variance ${result.unconditionalVariance.toFixed(6)}; log likelihood ${result.logLikelihood.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 2,
            cols: n,
            mu,
            omega,
            alphas,
            persistence: result.persistence,
            unconditionalVariance: result.unconditionalVariance,
            logLikelihood: result.logLikelihood,
            variances: result.variances,
            shocks: result.shocks,
            phase: "done",
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Big price moves tend to cluster even when their direction does not. ARCH models the variance of today's return as a baseline plus a weighted memory of recent squared surprises. A large shock inflates subsequent variance, which then decays as that shock ages out of the lag window.",
        invariants: [
            "Every conditional variance is omega plus a sum of nonnegative lagged squared shocks.",
            "The unconditional variance omega over one minus the sum of alphas is the fixed point when shocks vanish.",
            "Persistence equals the sum of the alpha weights and must be below one for a finite long-run variance.",
        ],
        correctness:
            "The recursion is the definition of ARCH(q): each variance is omega plus alpha_i times the shock i steps earlier, with pre-sample shocks taken as zero. Taking expectations on both sides when shocks have constant variance gives Var = omega + (sum alpha_i) Var, so solving yields omega / (1 - sum alpha_i), finite exactly when the sum is below one. The Gaussian log likelihood sums minus one half of log(2 pi sigma2_t) plus epsilon_t squared over sigma2_t, the standard conditional normal density.",
        complexityRationale:
            "Each of the n returns touches q lagged shocks, so filtering is O(n q) time; storing the variance path for display uses O(n) space.",
        uses: [
            "Modeling volatility clustering in financial returns",
            "Value-at-risk and portfolio risk estimation",
            "Detecting heteroskedasticity in econometric residuals",
        ],
        references: [
            "Engle, Autoregressive Conditional Heteroskedasticity with Estimates of the Variance of United Kingdom Inflation, 1982",
            "Bollerslev, Chou and Kroner, ARCH Modeling in Finance, 1992",
        ],
        workedExample:
            "With omega = 0.0002, alphas = [0.35, 0.25], persistence is 0.6 and the long-run variance is 0.0002 / 0.4 = 0.0005. After a shock of 0.03, the next two variances include 0.35 times 0.0009 and 0.25 times 0.0009 respectively, then the effect fades as the shock leaves the two-lag window.",
    },
    id: "arch-model",
    name: "ARCH(q) Model",
    category: "statistics-probability",
    complexity: { time: "O(n q)", space: "O(n)" },
    defaultInput: {
        returns: [0.01, -0.02, 0.015, -0.008, 0.02, -0.012, 0.006, -0.004],
        mu: 0,
        omega: 0.0002,
        alphas: [0.35, 0.25],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "treat the first q lagged squared shocks as zero",
        "for each return compute the shock r minus mu",
        "set variance to omega plus the weighted sum of the previous q squared shocks",
        "add the Gaussian log density of the shock under this variance",
        "advance the shock history by one step",
        "compute long-run variance omega over one minus the sum of alphas",
        "report the variance path and total log likelihood",
    ],
};

export default module;

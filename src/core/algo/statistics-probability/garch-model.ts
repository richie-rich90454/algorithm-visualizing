/**
 * garch-model.ts - GARCH(1,1) Conditional Variance Filter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A GARCH(1,1) model describes time-varying volatility. For a return series r_t
 * with mean mu, the shock is epsilon_t = r_t - mu and the conditional variance
 * obeys sigma2_t = omega + alpha epsilon_{t-1}^2 + beta sigma2_{t-1}. Starting
 * from the unconditional variance omega / (1 - alpha - beta), the filter walks
 * forward through the returns and also reports the Gaussian log likelihood.
 * The sum alpha + beta is the persistence of volatility shocks.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n returns
 *   Space: O(n) for the variance path and display cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero of the grid holds the return shocks.
 *   - Row one holds the conditional variance at each time step.
 *   - The active time step is highlighted while the recursion is explained.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface GarchResult {
    returns: number[];
    shocks: number[];
    variances: number[];
    logLikelihood: number;
    persistence: number;
    unconditionalVariance: number;
}

/** Run the GARCH(1,1) recursion over a return series. */
export function garchFilter(
    returns: number[],
    mu: number,
    omega: number,
    alpha: number,
    beta: number,
): GarchResult {
    const persistence = alpha + beta;
    const scale = Math.max(1e-9, 1 - persistence);
    const unconditionalVariance = omega / scale;
    const shocks: number[] = [];
    const variances: number[] = [];
    let previousShock = 0;
    let previousVariance = unconditionalVariance;
    let logLikelihood = 0;

    for (const r of returns) {
        const shock = r - mu;
        const variance = omega + alpha * previousShock * previousShock + beta * previousVariance;
        const safeVariance = Math.max(1e-12, variance);
        logLikelihood += -0.5 * (Math.log(2 * Math.PI * safeVariance) + (shock * shock) / safeVariance);
        shocks.push(shock);
        variances.push(variance);
        previousShock = shock;
        previousVariance = variance;
    }

    return {
        returns: [...returns],
        shocks,
        variances,
        logLikelihood,
        persistence,
        unconditionalVariance,
    };
}

/** Two-row grid: returns above, conditional variance below. */
function makeCells(result: GarchResult, active: number, phase: string): VisualEntity[] {
    const n = result.returns.length;
    const cells: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < n; col += 1) {
            const value = row === 0 ? (result.returns[col] ?? 0) : (result.variances[col] ?? 0);
            let state: EntityState = "idle";
            if (phase === "done") {
                state = "sorted";
            } else if (col === active) {
                state = "comparing";
            } else if (col < active) {
                state = "visited";
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: row === 0 ? `r=${value.toFixed(3)}` : `s2=${value.toFixed(4)}`,
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

/** The GARCH(1,1) generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            returns?: number[];
            mu?: number;
            omega?: number;
            alpha?: number;
            beta?: number;
        } | null) ?? {};
    const returns = Array.isArray(task.returns) && task.returns.length > 0
        ? task.returns.map((v) => Number(v) || 0)
        : [0.01, -0.02, 0.015, -0.008, 0.02, -0.012, 0.006, -0.004];
    const mu = Number(task.mu ?? 0) || 0;
    const alpha = Math.max(0, Number(task.alpha ?? 0.1) || 0.1);
    const beta = Math.max(0, Number(task.beta ?? 0.85) || 0.85);
    const omega = Math.max(1e-6, Number(task.omega ?? 0.0001) || 0.0001);
    const result = garchFilter(returns, mu, omega, alpha, beta);
    const n = returns.length;

    yield {
        stepNumber: 0,
        entities: makeCells(result, -1, "setup"),
        edges: [],
        description: `Filtering ${n} returns with GARCH(1,1): omega ${omega}, alpha ${alpha}, beta ${beta}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 2,
            cols: n,
            mu,
            omega,
            alpha,
            beta,
            persistence: result.persistence,
            unconditionalVariance: result.unconditionalVariance,
            logLikelihood: 0,
            variances: [] as number[],
            shocks: [] as number[],
            phase: "setup",
        },
    };

    let previousShock = 0;
    let previousVariance = result.unconditionalVariance;
    let likelihood = 0;
    for (let t = 0; t < n; t += 1) {
        const shock = (returns[t] ?? 0) - mu;
        const variance = omega + alpha * previousShock * previousShock + beta * previousVariance;
        const safeVariance = Math.max(1e-12, variance);
        likelihood += -0.5 * (Math.log(2 * Math.PI * safeVariance) + (shock * shock) / safeVariance);
        yield {
            stepNumber: 1 + t,
            entities: makeCells(result, t, "step"),
            edges: [],
            description: `Step ${t + 1}: shock ${shock.toFixed(5)}, variance = ${omega} + ${alpha} x ${(previousShock * previousShock).toFixed(6)} + ${beta} x ${previousVariance.toFixed(6)} = ${variance.toFixed(6)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 2,
                cols: n,
                mu,
                omega,
                alpha,
                beta,
                persistence: result.persistence,
                unconditionalVariance: result.unconditionalVariance,
                logLikelihood: likelihood,
                variances: result.variances.slice(0, t + 1),
                shocks: result.shocks.slice(0, t + 1),
                phase: "step",
                time: t,
                variance,
                shock,
            },
        };
        previousShock = shock;
        previousVariance = variance;
    }

    yield {
        stepNumber: 1 + n,
        entities: makeCells(result, -1, "done"),
        edges: [],
        description: `Persistence alpha + beta = ${result.persistence.toFixed(4)}; long-run variance ${result.unconditionalVariance.toFixed(6)}; log likelihood ${result.logLikelihood.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 2,
            cols: n,
            mu,
            omega,
            alpha,
            beta,
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

/** The GARCH(1,1) module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Volatility clusters: large moves tend to follow large moves. GARCH models the current variance as a weighted mix of a long-run baseline, yesterday's squared shock, and yesterday's variance. A shock raises variance immediately, and the beta term lets that elevation decay gradually instead of vanishing overnight.",
        invariants: [
            "Every conditional variance is omega plus a nonnegative shock term plus a nonnegative lagged variance term.",
            "The unconditional variance omega / (1 - alpha - beta) is the fixed point of the recursion when shocks vanish.",
            "Persistence equals alpha + beta and must be below one for a stationary variance.",
        ],
        correctness:
            "The recursion is the definition of the GARCH(1,1) filter: substituting epsilon_{t-1} = r_{t-1} - mu and sigma2_{t-1} gives exactly the variance computed at each step. Setting all shocks to their zero mean and solving sigma2 = omega + beta sigma2 yields the long-run variance omega / (1 - alpha - beta), which is finite exactly when alpha + beta is below one. The Gaussian log likelihood sums minus one half of log(2 pi sigma2_t) plus epsilon_t squared over sigma2_t, the standard conditional normal density.",
        complexityRationale:
            "Each return requires a fixed number of multiplications and one logarithm for the likelihood, so filtering n observations takes O(n) time and O(n) space to keep the variance path for display.",
        uses: [
            "Forecasting volatility for risk management and value at risk",
            "Pricing derivatives under stochastic volatility",
            "Modeling clustered variance in financial and economic time series",
        ],
        references: [
            "Bollerslev, Generalized Autoregressive Conditional Heteroskedasticity, 1986",
            "Engle, Autoregressive Conditional Heteroskedasticity with Estimates of the Variance of United Kingdom Inflation, 1982",
        ],
        workedExample:
            "With omega = 0.0001, alpha = 0.1, beta = 0.85, the long-run variance is 0.0001 / 0.05 = 0.002. After a shock of 0.03, the next variance becomes 0.0001 + 0.1 times 0.0009 plus 0.85 times 0.002, about 0.00179, and then decays back toward 0.002 as later shocks fade.",
    },
    id: "garch-model",
    name: "GARCH(1,1) Model",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        returns: [0.01, -0.02, 0.015, -0.008, 0.02, -0.012, 0.006, -0.004],
        mu: 0,
        omega: 0.0001,
        alpha: 0.1,
        beta: 0.85,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set the initial variance to omega divided by one minus alpha minus beta",
        "for each return compute the shock r minus mu",
        "set variance to omega plus alpha times the previous shock squared plus beta times the previous variance",
        "add the Gaussian log density of the shock under this variance",
        "advance the previous shock and previous variance",
        "report persistence, long-run variance, and total log likelihood",
        "done: return the full conditional variance path",
    ],
};

export default module;

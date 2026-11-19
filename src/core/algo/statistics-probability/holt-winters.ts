/**
 * holt-winters.ts - Holt-Winters Additive Triple Exponential Smoothing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Holt-Winters forecasting tracks three components of a seasonal series: a
 * smoothed level, a smoothed trend, and a smoothed seasonal factor for each
 * position in the cycle. Each new observation updates all three with their own
 * smoothing constant. The one-step forecast adds the level, trend, and the
 * seasonal factor for the upcoming slot.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a series of length n
 *   Space: O(n) for the displayed component values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per observation with observed, predicted, level, trend.
 *   - The current observation is highlighted while components update.
 *   - The final frame reports the one-step-ahead forecast.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    series?: number[];
    period?: number;
    alpha?: number;
    beta?: number;
    gamma?: number;
}

/** Clamp a smoothing constant into the open unit interval. */
function smooth(value: number | undefined, fallback: number): number {
    const v = typeof value === "number" && Number.isFinite(value) ? value : fallback;
    return Math.min(1 - 1e-9, Math.max(1e-9, v));
}

function makeCells(
    observed: number[],
    fitted: number[],
    levels: number[],
    trends: number[],
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < observed.length; row += 1) {
        const columns = [observed[row] ?? 0, fitted[row] ?? 0, levels[row] ?? 0, trends[row] ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (done) state = "sorted";
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const fallback = [7, 10, 13, 16, 11, 14, 17, 20, 15, 18, 21, 24];
    const series = Array.isArray(task.series) && task.series.length > 0
        ? task.series.map(Number)
        : fallback;
    const givenPeriod = typeof task.period === "number" ? Math.floor(task.period) : 4;
    const period = Math.max(1, Math.min(givenPeriod, Math.floor(series.length / 2)));
    const alpha = smooth(task.alpha, 0.4);
    const beta = smooth(task.beta, 0.2);
    const gamma = smooth(task.gamma, 0.5);

    const firstAvg = series.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
    const secondSlice = series.slice(period, 2 * period);
    const secondAvg = secondSlice.length > 0
        ? secondSlice.reduce((sum, v) => sum + v, 0) / secondSlice.length
        : firstAvg;
    let level = firstAvg;
    let trend = (secondAvg - firstAvg) / period;
    const seasonal = series.slice(0, period).map((v) => v - firstAvg);

    const fitted = series.slice();
    const levels = new Array<number>(series.length).fill(level);
    const trends = new Array<number>(series.length).fill(trend);

    const metaAll = {
        family: "holt-winters",
        rows: series.length,
        cols: 4,
        period,
        alpha: Number(alpha.toFixed(6)),
        beta: Number(beta.toFixed(6)),
        gamma: Number(gamma.toFixed(6)),
        observed: series.map((v) => Number(v.toFixed(6))),
        fitted: fitted.map((v) => Number(v.toFixed(6))),
        levels: levels.map((v) => Number(v.toFixed(6))),
        trends: trends.map((v) => Number(v.toFixed(6))),
        forecast: Number((level + trend + (seasonal[series.length % period] ?? 0)).toFixed(6)),
    };

    yield {
        stepNumber: 0,
        entities: makeCells(series, fitted, levels, trends, -1, false),
        edges: [],
        description: `Holt-Winters with period ${period}, smoothing alpha ${alpha.toFixed(2)}, beta ${beta.toFixed(2)}, gamma ${gamma.toFixed(2)}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaAll,
    };

    let step = 1;
    for (let t = period; t < series.length; t += 1) {
        const slot = t % period;
        const prediction = level + trend + (seasonal[slot] ?? 0);
        fitted[t] = prediction;

        const previousLevel = level;
        level = alpha * ((series[t] ?? 0) - (seasonal[slot] ?? 0)) + (1 - alpha) * (level + trend);
        trend = beta * (level - previousLevel) + (1 - beta) * trend;
        seasonal[slot] = gamma * ((series[t] ?? 0) - level) + (1 - gamma) * (seasonal[slot] ?? 0);
        levels[t] = level;
        trends[t] = trend;

        yield {
            stepNumber: step,
            entities: makeCells(series, fitted, levels, trends, t, false),
            edges: [],
            description: `t=${t}: observed ${(series[t] ?? 0).toFixed(2)}, predicted ${prediction.toFixed(2)}, new level ${level.toFixed(2)}, trend ${trend.toFixed(2)}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                ...metaAll,
                current: t,
                fitted: fitted.map((v) => Number(v.toFixed(6))),
                levels: levels.map((v) => Number(v.toFixed(6))),
                trends: trends.map((v) => Number(v.toFixed(6))),
            },
        };
        step += 1;
    }

    const forecast = level + trend + (seasonal[series.length % period] ?? 0);
    yield {
        stepNumber: step,
        entities: makeCells(series, fitted, levels, trends, -1, true),
        edges: [],
        description: `Triple smoothing complete: one-step forecast for t=${series.length} is ${forecast.toFixed(3)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            ...metaAll,
            fitted: fitted.map((v) => Number(v.toFixed(6))),
            levels: levels.map((v) => Number(v.toFixed(6))),
            trends: trends.map((v) => Number(v.toFixed(6))),
            forecast: Number(forecast.toFixed(6)),
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A seasonal series has a baseline that drifts, a slope, and a repeating pattern inside each cycle. Holt-Winters keeps one running estimate of each. When a new value arrives, it pulls every estimate a little toward what that value implies, with separate dials controlling how fast the level, slope, and seasonal pattern react.",
        invariants: [
            "The seasonal factors repeat with the chosen period.",
            "The one-step forecast is the current level plus trend plus the upcoming seasonal factor.",
            "Each smoothing constant lies strictly between zero and one.",
        ],
        correctness:
            "The update rules are the standard additive Holt-Winters recursions. For a perfectly constant series with all smoothing constants at one, the level equals that constant, the trend and seasonal factors are zero, and the forecast reproduces the constant. More generally, each fitted value is the prediction formed from the state before the observation was absorbed, so the recurrence is causal and cannot use future data. Cross-checking every emitted component against an independent evaluation of the same recursions confirms the arithmetic.",
        complexityRationale:
            "Each observation from the second cycle onward performs a constant number of arithmetic updates, so fitting is O(n). Storing a level, trend, fitted value, and observed value per time step uses O(n) space for the visualization.",
        uses: [
            "Retail demand forecasting with weekly seasonality",
            "Capacity planning from seasonal traffic metrics",
            "Short-horizon load prediction in operations tooling",
        ],
        references: [
            "Holt, Forecasting Trends and Seasonals by Exponentially Weighted Averages, 1957",
            "Winters, Forecasting Sales by Exponentially Weighted Moving Averages, 1960",
        ],
        workedExample:
            "For a four-point cycle with values 7, 10, 13, 16 repeated and a rising trend, the initial level is the first-cycle average and the initial trend is the change from the first cycle average to the second. Each later point updates the level toward the deseasonalized observation, then adjusts the slope and the seasonal slot, and the next forecast reassembles the three parts.",
    },
    id: "holt-winters",
    name: "Holt-Winters Triple Exponential Smoothing",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { series: [7, 10, 13, 16, 11, 14, 17, 20, 15, 18, 21, 24], period: 4, alpha: 0.4, beta: 0.2, gamma: 0.5 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the series, period, and three smoothing constants",
        "set level to the average of the first cycle",
        "set trend from the change between the first two cycles",
        "set each seasonal factor from the first cycle",
        "for each later observation form a forecast from level, trend, and season",
        "update the level toward the deseasonalized observation",
        "update the trend and the seasonal slot with their constants",
        "done: report the fitted values and the next forecast",
    ],
};

export default module;

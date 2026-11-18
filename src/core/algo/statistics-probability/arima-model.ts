/**
 * arima-model.ts - ARIMA(p,d,q) Differencing, Fit and Forecast
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An ARIMA(p,d,q) model explains a time series by differencing it d times to
 * remove trend, then fitting an ARMA(p,q) recursion: the differenced value is a
 * linear combination of its p past values plus the current innovation and q
 * past innovations. Given the coefficients and the innovation series, the
 * one-step fitted values and residuals are computed directly, future
 * differenced values are forecast by continuing the recursion with zero future
 * innovations, and the d inverse differences turn those forecasts back into
 * original-scale predictions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * (p + q) + steps * (p + q)) for n observations
 *   Space: O(n + steps) for the differenced, fitted and forecast series
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the original series and then the forecast continuation.
 *   - The bar under consideration is yellow; forecast bars are green.
 *   - meta carries every intermediate series for reconstruction checks.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Forward difference: w[i] = x[i+1] - x[i]. */
function difference(series: number[]): number[] {
    const out: number[] = [];
    for (let i = 0; i + 1 < series.length; i += 1) {
        out.push((series[i + 1] ?? 0) - (series[i] ?? 0));
    }
    return out;
}

function makeBars(values: number[], active: number, done: boolean, forecastFrom: number): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (index >= forecastFrom) {
            state = "sorted";
        } else if (done) {
            state = "path";
        } else if (index === active) {
            state = "comparing";
        } else if (index < active) {
            state = "visited";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: index >= forecastFrom ? `f${index - forecastFrom}:${value.toFixed(2)}` : `t${index}:${value.toFixed(2)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value, forecast: index >= forecastFrom },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        series?: number[];
        d?: number;
        phi?: number[];
        theta?: number[];
        eps?: number[];
        steps?: number;
    } | null) ?? {};
    const series = (Array.isArray(task.series) ? task.series : [10, 12, 13, 15, 14, 17, 16, 19, 21, 20])
        .map((v) => Number(v)).filter((v) => Number.isFinite(v));
    const safeSeries = series.length >= 3 ? series : [10, 12, 13, 15, 14, 17, 16, 19, 21, 20];
    const d = Math.min(2, Math.max(0, Math.floor(Number(task.d ?? 1)) || 0));
    const p = Math.max(0, (Array.isArray(task.phi) ? task.phi : [0.6]).length);
    const q = Math.max(0, (Array.isArray(task.theta) ? task.theta : [0.4]).length);
    const phi = Array.isArray(task.phi) ? task.phi.map((v) => Number(v)) : [0.6];
    const theta = Array.isArray(task.theta) ? task.theta.map((v) => Number(v)) : [0.4];
    const steps = Math.min(10, Math.max(0, Math.floor(Number(task.steps ?? 3)) || 0));

    // Differencing levels: levels[j] is the series differenced j times.
    const levels: number[][] = [[...safeSeries]];
    for (let level = 1; level <= d; level += 1) {
        levels.push(difference(levels[level - 1] ?? []));
    }
    const w = levels[d] ?? [];
    const m = w.length;
    const eps = Array.isArray(task.eps) && task.eps.length >= m
        ? task.eps.slice(0, m).map((v) => Number(v))
        : Array.from({ length: m }, (_, i) => Math.round(Math.sin((i + 1) * 1.7) * 100) / 100);
    const start = Math.max(p, q);

    const fitted = new Array<number>(m).fill(0);
    const residuals = new Array<number>(m).fill(0);
    for (let t = start; t < m; t += 1) {
        let value = 0;
        for (let i = 1; i <= p; i += 1) {
            value += (phi[i - 1] ?? 0) * (w[t - i] ?? 0);
        }
        for (let j = 1; j <= q; j += 1) {
            value += (theta[j - 1] ?? 0) * (eps[t - j] ?? 0);
        }
        fitted[t] = value;
        residuals[t] = (w[t] ?? 0) - value;
    }

    // Continue the recursion into the future with zero future innovations.
    const forecastDiffed: number[] = [];
    for (let h = 1; h <= steps; h += 1) {
        const t = m + h - 1;
        let value = 0;
        for (let i = 1; i <= p; i += 1) {
            const lag = t - i;
            value += (phi[i - 1] ?? 0) * (lag < m ? (w[lag] ?? 0) : (forecastDiffed[lag - m] ?? 0));
        }
        for (let j = 1; j <= q; j += 1) {
            const lag = t - j;
            if (lag < m) {
                value += (theta[j - 1] ?? 0) * (eps[lag] ?? 0);
            }
        }
        forecastDiffed.push(value);
    }

    // Undo the differences to get back to the original scale.
    let reconstructed = [...w, ...forecastDiffed];
    for (let level = d; level >= 1; level -= 1) {
        const initial = levels[level - 1]?.[0] ?? 0;
        const next: number[] = [initial];
        for (let i = 0; i < reconstructed.length; i += 1) {
            next.push((next[next.length - 1] ?? 0) + (reconstructed[i] ?? 0));
        }
        reconstructed = next;
    }
    const forecast = reconstructed.slice(safeSeries.length);

    const meta = (phase: string, active: number) => ({
        phase,
        active,
        d,
        p,
        q,
        steps,
        phi,
        theta,
        eps,
        levelLengths: levels.map((level) => level.length),
        diffed: [...w],
        fitted: [...fitted],
        residuals: [...residuals],
        forecastDiffed: [...forecastDiffed],
        reconstructed: [...reconstructed],
        forecast: [...forecast],
        series: [...safeSeries],
    });

    yield {
        stepNumber: 0,
        entities: makeBars(safeSeries, -1, false, safeSeries.length),
        edges: [],
        description: `ARIMA(${p}, ${d}, ${q}): ${safeSeries.length} observations, ${steps} forecast step(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta("setup", -1),
    };
    let step = 1;

    for (let level = 1; level <= d; level += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(levels[level] ?? [], -1, false, levels[level]?.length ?? 0),
            edges: [],
            description: `Difference pass ${level}: ${(levels[level] ?? []).length} value(s) remain after removing trend.`,
            codeLineNumber: 1,
            layout: "array",
            meta: meta("difference", -1),
        };
        step += 1;
    }

    for (let t = start; t < m; t += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(w, t, false, m),
            edges: [],
            description: `Time ${t}: fitted ${(fitted[t] ?? 0).toFixed(3)}, residual ${(residuals[t] ?? 0).toFixed(3)} against innovation ${(eps[t] ?? 0).toFixed(3)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: meta("fit", t),
        };
        step += 1;
    }

    for (let h = 0; h < steps; h += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(reconstructed, -1, false, safeSeries.length + h),
            edges: [],
            description: `Forecast step ${h + 1}: ${(forecast[h] ?? 0).toFixed(3)} on the original scale.`,
            codeLineNumber: 5,
            layout: "array",
            meta: meta("forecast", h),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(reconstructed, -1, true, safeSeries.length),
        edges: [],
        description: `ARIMA forecast: ${forecast.map((v) => v.toFixed(2)).join(", ")}; inverse differencing rebuilt the original series exactly.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...meta("done", -1), phase: "done" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Many time series wander because of trend rather than because each value depends on the last in a complicated way. Differencing removes that trend by storing only changes. What remains is modeled as a weighted sum of past changes and past surprises. Forecasting just continues that recurrence, and adding the changes back rebuilds predictions in the original units.",
        invariants: [
            "Applying d differences and then d inverse differences reconstructs the original series.",
            "The one-step residual equals the current innovation when the coefficients and innovations are consistent.",
            "Future innovations are set to zero in the forecast, so the forecast uses only known history.",
        ],
        correctness:
            "The forward difference and its cumulative-sum inverse are algebraic inverses, so rebuilding recovers the input series up to floating-point rounding. The one-step fit applies exactly the ARMA definition using past observed values and innovations, making the residual the innovation at that time. Forecasting continues the same recursion with zero future innovations, which is the conditional expectation of the ARMA process given the observed history, and undoing the differences returns those expectations to the original scale.",
        complexityRationale:
            "Each differencing pass and each fit step touches a constant p plus q neighbors, so the whole computation is O(n(p plus q) plus steps(p plus q)); storing the levels, fitted values and forecasts uses O(n plus steps) space.",
        uses: [
            "Short-horizon demand and revenue forecasting",
            "Modeling trending sensor and economic time series",
            "A baseline for comparing more complex forecasting models",
        ],
        references: [
            "Box and Jenkins, Time Series Analysis: Forecasting and Control, 1970",
            "Hyndman and Athanasopoulos, Forecasting: Principles and Practice",
        ],
        workedExample:
            "For the series 10, 12, 13, 15 with d = 1, the first difference is 2, 1, 2. With AR coefficient 0.6 the fitted second difference is 0.6 times 2 plus the innovation, so the residual reports the remaining surprise. Continuing the recursion with zero future innovations and cumulatively adding the differences returns forecasts in the original units.",
    },
    id: "arima-model",
    name: "ARIMA Model",
    category: "statistics-probability",
    complexity: { time: "O(n * (p + q) + steps * (p + q))", space: "O(n + steps)" },
    defaultInput: {
        series: [10, 12, 13, 15, 14, 17, 16, 19, 21, 20],
        d: 1,
        phi: [0.6],
        theta: [0.4],
        steps: 3,
    },
    visualType: "array",
    run,
    pseudocode: [
        "difference the series d times to remove trend",
        "initialize fitted values and residuals to zero",
        "for each time step form the ARMA fit from p past values and q past innovations",
        "record the residual as the observed minus fitted value",
        "forecast future differenced values with zero future innovations",
        "apply d inverse differences to the forecasts",
        "done: report fitted values, residuals and original-scale forecasts",
    ],
};

export default module;

/**
 * partial-autocorrelation.ts - Partial Autocorrelation Function (Durbin-Levinson)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The partial autocorrelation at lag k measures the correlation between x_t and
 * x_{t-k} after removing the linear effect of the intervening lags. Computing
 * a separate regression for every lag would be expensive, so the Durbin-Levinson
 * recursion updates all lag coefficients from the ordinary autocorrelations.
 * At lag one the partial autocorrelation equals the ordinary autocorrelation;
 * for an autoregressive process of order p it is essentially zero beyond p.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * maxLag + maxLag^2) for autocorrelations and the recursion
 *   Space: O(maxLag^2) for the recursively updated coefficient table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per lag shows the partial autocorrelation at that lag.
 *   - The bar being evaluated is yellow; the finished sequence is green.
 *   - The final frame reports the lag-one value and the full sequence.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `lag ${index}: ${value.toFixed(4)}`,
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, lag: index, pacf: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { series?: number[]; maxLag?: number } | null) ?? {};
    const series: number[] = Array.isArray(task.series)
        ? task.series.filter((value) => Number.isFinite(value))
        : [2.1, 2.6, 2.2, 1.8, 2.4, 3.1, 2.9, 2.5, 3.3, 3.8, 3.4, 3.0, 3.6, 4.2, 4.0, 3.5, 4.1, 4.7, 4.3, 3.9];
    const requestedLag = typeof task.maxLag === "number" ? Math.floor(task.maxLag) : 5;
    const n = series.length;
    const maxLag = Math.max(1, Math.min(requestedLag, n - 2));
    const mean = series.reduce((sum, value) => sum + value, 0) / (n || 1);
    const centered = series.map((value) => value - mean);
    let c0 = 0;
    for (const value of centered) c0 += value * value;

    const acf: number[] = [1];
    for (let lag = 1; lag <= maxLag; lag += 1) {
        let sum = 0;
        for (let t = lag; t < n; t += 1) {
            sum += (centered[t] as number) * (centered[t - lag] as number);
        }
        acf.push(c0 > 0 ? sum / c0 : 0);
    }

    const pacf: number[] = [1, acf[1] as number];
    const phi: number[][] = Array.from({ length: maxLag + 1 }, () => new Array<number>(maxLag + 1).fill(0));
    if (maxLag >= 1) (phi[1] as number[])[1] = acf[1] as number;

    for (let lag = 2; lag <= maxLag; lag += 1) {
        const previous = phi[lag - 1] as number[];
        let numerator = acf[lag] as number;
        let denominator = 1;
        for (let j = 1; j < lag; j += 1) {
            const coefficient = previous[j] as number;
            numerator -= coefficient * (acf[lag - j] as number);
            denominator -= coefficient * (acf[j] as number);
        }
        const lastCoefficient = Math.abs(denominator) > 1e-12 ? numerator / denominator : 0;
        const current = phi[lag] as number[];
        for (let j = 1; j < lag; j += 1) {
            current[j] = (previous[j] as number) - lastCoefficient * (previous[lag - j] as number);
        }
        current[lag] = lastCoefficient;
        pacf.push(lastCoefficient);
    }

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(maxLag + 1).fill(0), -1, false),
        edges: [],
        description: `Computing partial autocorrelations for ${n} observation(s) up to lag ${maxLag}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, maxLag, series, acf, pacf: [], complete: false },
    };
    let step = 1;

    for (let lag = 0; lag <= maxLag; lag += 1) {
        yield {
            stepNumber: step,
            entities: makeBars([...pacf.slice(0, lag + 1), ...new Array<number>(maxLag - lag).fill(0)], lag, false),
            edges: [],
            description: `Lag ${lag}: partial autocorrelation ${(pacf[lag] as number).toFixed(4)}.`,
            codeLineNumber: lag === 0 ? 1 : lag === 1 ? 3 : 5,
            layout: "array",
            meta: { n, maxLag, series, acf, pacf: pacf.slice(0, lag + 1), complete: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pacf, maxLag + 1, true),
        edges: [],
        description: `Partial autocorrelation complete: lag one ${pacf[1]?.toFixed(4)} across ${maxLag + 1} lag(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, maxLag, series, acf, pacf, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The ordinary autocorrelation at lag two can be large simply because x_t and x_{t-2} are both correlated with x_{t-1}. The partial autocorrelation strips out that indirect path by regressing on all shorter lags first and measuring only what remains. Plotting these values by lag is one of the main tools for recognizing the order of an autoregressive model.",
        invariants: [
            "The partial autocorrelation at lag zero is one.",
            "The partial autocorrelation at lag one equals the ordinary autocorrelation at lag one.",
            "For an AR(p) process the values beyond lag p are close to zero.",
        ],
        correctness:
            "Durbin-Levinson updates the coefficients of the best linear predictor of order k from those of order k minus one. The new coefficient equals the remaining autocorrelation numerator divided by the prediction-error variance denominator, which is exactly the last regression coefficient in a least-squares fit on lags one through k. By the Yule-Walker equations this last coefficient is the partial autocorrelation, so the recursion reproduces the direct regression answer.",
        complexityRationale:
            "Each autocorrelation sums at most n products, giving O(n times maxLag). The recursion touches a triangular table of coefficients, so it adds O(maxLag^2) work and space.",
        uses: [
            "Identifying the order of an autoregressive time-series model",
            "Checking whether residuals from a fitted model remain correlated",
            "A teaching tool for direct versus indirect correlation",
        ],
        references: [
            "Box, Jenkins, and Reinsel, Time Series Analysis: Forecasting and Control, Chapter 3",
            "Brockwell and Davis, Introduction to Time Series and Forecasting, Chapter 5",
        ],
        workedExample:
            "For a series generated by x_t = 0.6 x_{t-1} plus noise, the lag-one partial autocorrelation is about 0.6, while lags two and three are near zero because there is no direct dependence beyond one step. A moving-average series instead shows a gradual decay in the partial autocorrelations.",
    },
    id: "partial-autocorrelation",
    name: "Partial Autocorrelation (Durbin-Levinson)",
    category: "statistics-probability",
    complexity: { time: "O(n * maxLag + maxLag^2)", space: "O(maxLag^2)" },
    defaultInput: {
        series: [2.1, 2.6, 2.2, 1.8, 2.4, 3.1, 2.9, 2.5, 3.3, 3.8, 3.4, 3.0, 3.6, 4.2, 4.0, 3.5, 4.1, 4.7, 4.3, 3.9],
        maxLag: 5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the series and the maximum lag",
        "center the series and compute autocorrelations up to the maximum lag",
        "set lag zero partial autocorrelation to one and lag one to the first autocorrelation",
        "for each later lag compute the recursion numerator and denominator",
        "set the new coefficient to numerator over denominator",
        "update the earlier coefficients with the new coefficient",
        "done: report the partial autocorrelation at every lag",
    ],
};

export default module;

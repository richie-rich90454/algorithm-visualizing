/**
 * vector-autoregression.ts - Vector Autoregression VAR(1)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A VAR(1) model explains a vector of k time series with their own values one
 * step earlier: y_t = c + A y_{t-1}. Stacking the lagged rows into a design
 * matrix Z and the targets into Y turns fitting into a least-squares problem
 * Z B = Y, solved through the normal equations (Z'Z) B = Z'Y with Gaussian
 * elimination. The fitted coefficient matrix drives one-step fits and a
 * multi-step forecast obtained by repeatedly applying y = c + A y.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n k^3) for n observations of k series (cubic solve per column)
 *   Space: O(k^2) for the coefficient matrix and normal-equation buffers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid shows the transition matrix A; each cell is a coefficient.
 *   - The row being solved is highlighted, then the whole matrix when done.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface VarFit {
    transition: number[][];
    intercept: number[];
}

/** Solve A x = b by Gaussian elimination with partial pivoting. */
export function solveLinear(matrix: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const a = matrix.map((row, i) => [...row, rhs[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(a[r]?.[col] ?? 0) > Math.abs(a[pivot]?.[col] ?? 0)) {
                pivot = r;
            }
        }
        const pivotRow = a[pivot];
        const currentRow = a[col];
        if (!pivotRow || !currentRow) {
            continue;
        }
        [a[pivot], a[col]] = [currentRow, pivotRow];
        const pivotValue = a[col]?.[col] ?? 0;
        if (Math.abs(pivotValue) < 1e-12) {
            continue;
        }
        for (let r = 0; r < n; r += 1) {
            if (r === col) {
                continue;
            }
            const factor = (a[r]?.[col] ?? 0) / pivotValue;
            for (let c = col; c <= n; c += 1) {
                a[r]![c] = (a[r]?.[c] ?? 0) - factor * (a[col]?.[c] ?? 0);
            }
        }
    }
    return a.map((row, i) => {
        const pivot = row[i] ?? 0;
        return Math.abs(pivot) < 1e-12 ? 0 : (row[n] ?? 0) / pivot;
    });
}

/** Fit a VAR(1) model to a multivariate series. */
export function fitVAR(series: number[][], k: number): VarFit {
    const n = series.length;
    const p = k + 1;
    const gram: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    const cross: number[][] = Array.from({ length: p }, () => new Array<number>(k).fill(0));
    for (let t = 1; t < n; t += 1) {
        const z: number[] = [1, ...(series[t - 1] ?? []).slice(0, k)];
        const y = (series[t] ?? []).slice(0, k);
        while (z.length < p) {
            z.push(0);
        }
        for (let i = 0; i < p; i += 1) {
            for (let j = 0; j < p; j += 1) {
                gram[i]![j] = (gram[i]![j] ?? 0) + (z[i] ?? 0) * (z[j] ?? 0);
            }
            for (let j = 0; j < k; j += 1) {
                cross[i]![j] = (cross[i]![j] ?? 0) + (z[i] ?? 0) * (y[j] ?? 0);
            }
        }
    }
    const coefficients: number[][] = [];
    for (let j = 0; j < k; j += 1) {
        const rhs = cross.map((row) => row[j] ?? 0);
        coefficients.push(solveLinear(gram, rhs));
    }
    const intercept: number[] = [];
    const transition: number[][] = [];
    for (let j = 0; j < k; j += 1) {
        const column = coefficients[j] ?? [];
        intercept.push(column[0] ?? 0);
        const row: number[] = [];
        for (let i = 0; i < k; i += 1) {
            row.push(column[i + 1] ?? 0);
        }
        transition.push(row);
    }
    return { transition, intercept };
}

/** Apply one VAR step: y_next = c + A y. */
export function varStep(fit: VarFit, y: number[]): number[] {
    return fit.transition.map((row, i) => {
        let total = fit.intercept[i] ?? 0;
        for (let j = 0; j < row.length; j += 1) {
            total += (row[j] ?? 0) * (y[j] ?? 0);
        }
        return total;
    });
}

function makeCells(transition: number[][], activeRow: number, done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < transition.length; r += 1) {
        for (let c = 0; c < (transition[r]?.length ?? 0); c += 1) {
            const value = transition[r]?.[c] ?? 0;
            let state: EntityState = "idle";
            if (done) {
                state = "sorted";
            } else if (r === activeRow) {
                state = "comparing";
            } else if (r < activeRow) {
                state = "visited";
            }
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: `a${r}${c}=${value.toFixed(3)}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { series?: number[][]; horizon?: number } | null) ?? {};
    const raw = Array.isArray(task.series) && task.series.length >= 4 ? task.series : [
        [0.1, -0.2],
        [0.5, 0.1],
        [0.2, 0.6],
        [0.8, 0.3],
        [0.4, 0.9],
        [1.0, 0.5],
        [0.7, 1.1],
    ];
    const series = raw.map((v) => [Number(v?.[0]) || 0, Number(v?.[1]) || 0]);
    const k = 2;
    const horizon = Math.max(1, Math.min(6, Math.floor(Number(task.horizon ?? 3) || 3)));
    const fit = fitVAR(series, k);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(fit.transition, -1, false),
        edges: [],
        description: `Fitting VAR(1) to ${series.length} observations of ${k} series.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: k, cols: k, horizon, observations: series.length },
    };
    step += 1;

    for (let j = 0; j < k; j += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(fit.transition, j, false),
            edges: [],
            description: `Solving normal equations for response column ${j} of the coefficient matrix.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: k,
                cols: k,
                horizon,
                solvingColumn: j,
                intercept: [...fit.intercept],
            },
        };
        step += 1;
    }

    const fits: number[][] = [];
    for (let t = 1; t < series.length; t += 1) {
        fits.push(varStep(fit, series[t - 1] as number[]));
    }

    let last = [...(series[series.length - 1] as number[])];
    const forecast: number[][] = [];
    for (let h = 0; h < horizon; h += 1) {
        last = varStep(fit, last);
        forecast.push([...last]);
        yield {
            stepNumber: step,
            entities: makeCells(fit.transition, -1, true),
            edges: [],
            description: `Forecast step ${h + 1}: y = [${last.map((v) => v.toFixed(3)).join(", ")}].`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { rows: k, cols: k, horizon, step: h + 1, forecast: [...last] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(fit.transition, -1, true),
        edges: [],
        description: `VAR(1) fitted; c = [${fit.intercept.map((v) => v.toFixed(3)).join(", ")}], ${horizon}-step forecast complete.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: k,
            cols: k,
            horizon,
            k,
            transitionFlat: fit.transition.flat(),
            intercept: fit.intercept,
            oneStepFitsFlat: fits.flat(),
            forecastFlat: forecast.flat(),
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A vector autoregression lets several time series influence each other. Each variable at time t is a linear combination of every variable at time t-1 plus a constant. Because the right-hand side is observed data, fitting the whole system is ordinary least squares repeated once per output variable.",
        invariants: [
            "Each row of the design matrix is the vector at time t-1 preceded by a constant one.",
            "The fitted coefficients satisfy the normal equations Z'Z B = Z'Y.",
            "A forecast is produced by repeatedly applying the same affine map to the previous vector.",
        ],
        correctness:
            "Stacking all observations gives Y = Z B exactly in the least-squares sense. Setting the derivative of the squared error to zero yields the normal equations (Z'Z) B = Z'Y; solving them with Gaussian elimination returns the unique minimizer when Z has full column rank. Once B is split into c and A, the recursion y_t = c + A y_{t-1} reproduces the one-step fitted values and extending it h times is the definition of an h-step forecast.",
        complexityRationale:
            "Building Z'Z and Z'Y scans n rows with O(k^2) work each, and each of the k columns needs an O(k^3) solve, giving O(n k^2 + k^4) time. Memory is O(k^2) for the Gram matrix and coefficients, independent of the series length.",
        uses: [
            "Macroeconomic forecasting of interacting indicators",
            "Modeling lead-lag relationships in finance and neuroscience",
            "Generating coherent multivariate synthetic trajectories",
        ],
        references: [
            "Lutkepohl, New Introduction to Multiple Time Series Analysis, Chapter 2",
            "Hamilton, Time Series Analysis, Chapter 11",
        ],
        workedExample:
            "For two series with observations (0.1,-0.2), (0.5,0.1), (0.2,0.6), the design rows are [1,0.1,-0.2] and [1,0.5,0.1] with responses (0.5,0.1) and (0.2,0.6). Solving the normal equations yields a 2 by 2 transition matrix and an intercept; applying it to the last vector gives the next forecast.",
    },
    id: "vector-autoregression",
    name: "Vector Autoregression VAR(1)",
    category: "statistics-probability",
    complexity: { time: "O(n k^3)", space: "O(k^2)" },
    defaultInput: {
        series: [
            [0.1, -0.2],
            [0.5, 0.1],
            [0.2, 0.6],
            [0.8, 0.3],
            [0.4, 0.9],
            [1.0, 0.5],
            [0.7, 1.1],
        ],
        horizon: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build lagged design rows z_t = one followed by y at t minus one",
        "accumulate the normal equations Z transpose Z and Z transpose Y",
        "solve each response column by Gaussian elimination",
        "split the solution into intercept c and transition matrix A",
        "compute one-step fitted values and residuals",
        "roll y = c plus A y forward for the forecast horizon",
        "report coefficients and the multi-step forecast",
    ],
};

export default module;

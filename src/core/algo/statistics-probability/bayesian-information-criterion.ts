/**
 * bayesian-information-criterion.ts - Bayesian Information Criterion
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BIC compares statistical models by balancing fit against complexity. For each
 * candidate polynomial degree it fits coefficients by least squares, computes
 * the maximum Gaussian log-likelihood, and scores the model as minus two times
 * that likelihood plus the parameter count times the log of the sample size.
 * The log n penalty grows with the data, so BIC favors simpler models than AIC
 * as samples accumulate. The model with the smallest BIC is selected.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(maxDegree * n * degree^2) for the normal-equation solves
 *   Space: O(degree^2) for the largest design system
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per evaluated degree encodes its BIC (lower is better).
 *   - The current best bar is CYAN; the final winner is GREEN.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Solve A x = b by Gauss-Jordan elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] | null {
    const n = b.length;
    if (n === 0) return [];
    const rows = A.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(rows[r]?.[col] ?? 0) > Math.abs(rows[pivot]?.[col] ?? 0)) pivot = r;
        }
        const pivotRow = rows[pivot];
        const currentRow = rows[col];
        if (!pivotRow || !currentRow || Math.abs(pivotRow[col] ?? 0) < 1e-12) return null;
        rows[col] = pivotRow;
        rows[pivot] = currentRow;
        const active = rows[col];
        if (!active) return null;
        const divisor = active[col] ?? 0;
        for (let c = col; c <= n; c += 1) active[c] = (active[c] ?? 0) / divisor;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const row = rows[r];
            if (!row) continue;
            const factor = row[col] ?? 0;
            for (let c = col; c <= n; c += 1) row[c] = (row[c] ?? 0) - factor * (active[c] ?? 0);
        }
    }
    return rows.map((row) => row[n] ?? 0);
}

interface Candidate {
    degree: number;
    k: number;
    rss: number;
    logL: number;
    aic: number;
    bic: number;
}

/** Build the bars for the candidates evaluated so far. */
function makeBars(candidates: Candidate[], bestDegree: number, final: boolean): VisualEntity[] {
    return candidates.map((candidate, index) => {
        const isBest = candidate.degree === bestDegree;
        const state: EntityState = final
            ? isBest
                ? "sorted"
                : "idle"
            : isBest
              ? "active"
              : "idle";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `d=${candidate.degree}: ${Number.isFinite(candidate.bic) ? candidate.bic.toFixed(2) : "inf"}`,
            value: Number.isFinite(candidate.bic) ? candidate.bic : 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, degree: candidate.degree },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { x?: number[]; y?: number[]; maxDegree?: number } | null) ?? {};
    const xs = task.x ?? [0, 1, 2, 3, 4, 5, 6];
    const ys = task.y ?? [2.12, 1.42, 1.55, 2.37, 4.09, 6.44, 9.74];
    const maxDegree =
        typeof task.maxDegree === "number" ? Math.max(0, Math.min(6, Math.floor(task.maxDegree))) : 4;
    const n = Math.min(xs.length, ys.length);

    const candidates: Candidate[] = [];
    let bestDegree = 0;
    let bestBic = Infinity;

    const initialBars: VisualEntity[] = Array.from({ length: maxDegree + 1 }, (_, degree) => ({
        id: `bar-${degree}`,
        type: "bar" as const,
        label: `d=${degree}`,
        value: 0,
        state: "idle" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: degree, degree },
    }));
    yield {
        stepNumber: 0,
        entities: initialBars,
        edges: [],
        description: `Comparing polynomial degrees 0 through ${maxDegree} on ${n} observations using BIC.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { observations: n, maxDegree, bestDegree: -1, bestBic: -1 },
    };

    for (let degree = 0; degree <= maxDegree; degree += 1) {
        const p = degree + 1;
        const xtx: number[][] = Array.from({ length: p }, () => Array<number>(p).fill(0));
        const xty: number[] = Array<number>(p).fill(0);
        for (let i = 0; i < n; i += 1) {
            const x = xs[i] ?? 0;
            const y = ys[i] ?? 0;
            const powers: number[] = [];
            for (let j = 0; j < p; j += 1) powers.push(Math.pow(x, j));
            for (let a = 0; a < p; a += 1) {
                xty[a] = (xty[a] ?? 0) + (powers[a] ?? 0) * y;
                for (let b = 0; b < p; b += 1) {
                    xtx[a] = xtx[a] ?? [];
                    xtx[a][b] = (xtx[a][b] ?? 0) + (powers[a] ?? 0) * (powers[b] ?? 0);
                }
            }
        }

        const beta = solve(xtx, xty);
        let rss = Infinity;
        if (beta) {
            rss = 0;
            for (let i = 0; i < n; i += 1) {
                const x = xs[i] ?? 0;
                let fit = 0;
                for (let j = 0; j < p; j += 1) fit += (beta[j] ?? 0) * Math.pow(x, j);
                rss += Math.pow((ys[i] ?? 0) - fit, 2);
            }
        }

        const sigma2 = rss / n;
        const logL = sigma2 > 0 ? (-n / 2) * (Math.log(2 * Math.PI * sigma2) + 1) : Infinity;
        const k = p + 1;
        const aic = -2 * logL + 2 * k;
        const bic = -2 * logL + k * Math.log(n);
        const candidate: Candidate = { degree, k, rss, logL, aic, bic };
        candidates.push(candidate);
        if (bic < bestBic) {
            bestBic = bic;
            bestDegree = degree;
        }

        yield {
            stepNumber: candidates.length,
            entities: makeBars(candidates, bestDegree, false),
            edges: [],
            description: `Degree ${degree}: ${k} parameters, residual sum ${rss.toFixed(3)}, BIC ${Number.isFinite(bic) ? bic.toFixed(2) : "inf"}; best so far degree ${bestDegree}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                observations: n,
                degree,
                k,
                rss,
                logL: Number.isFinite(logL) ? logL : -1,
                aic: Number.isFinite(aic) ? aic : -1,
                bic: Number.isFinite(bic) ? bic : -1,
                bestDegree,
            },
        };
    }

    yield {
        stepNumber: candidates.length + 1,
        entities: makeBars(candidates, bestDegree, true),
        edges: [],
        description: `Selected degree ${bestDegree} with the smallest BIC of ${Number.isFinite(bestBic) ? bestBic.toFixed(2) : "inf"}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            observations: n,
            bestDegree,
            bestBic: Number.isFinite(bestBic) ? bestBic : -1,
            candidates: candidates.map((c) => (Number.isFinite(c.bic) ? c.bic : -1)),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A more flexible model always fits the training data at least as well, so fit alone cannot guide model choice. BIC adds a price for every parameter, and that price rises with the logarithm of the sample size. You compute the best fit for each candidate, measure how likely the data is under it, then subtract the complexity price and keep the winner.",
        invariants: [
            "Residual sum of squares never increases as the degree grows.",
            "Each candidate's BIC equals minus two times its log-likelihood plus k log n.",
            "The selected degree is the one with the smallest BIC.",
        ],
        correctness:
            "Under regularity conditions the BIC is, up to a constant, the asymptotic negative log marginal likelihood of a model. The term k log n is the leading penalty from integrating out the parameters, which is why the criterion is consistent: as the sample size grows the true model is selected with probability approaching one, unlike AIC which remains asymptotically efficient but tends to overfit. Solving the normal equations gives the least-squares coefficients that maximize the Gaussian likelihood at the estimated variance, so the reported log-likelihoods are the maximized values BIC requires.",
        complexityRationale:
            "For each degree the design system is at most maxDegree by maxDegree and each entry sums n rows, so building and solving all systems costs O(maxDegree times n times degree squared). Only the largest system and the candidate list are held, giving polynomial but modest space.",
        uses: [
            "Choosing the order of a polynomial or autoregressive model",
            "Comparing clustering component counts in Gaussian mixtures",
            "Selecting covariates in regression when interpretability matters",
        ],
        references: [
            "Schwarz, Estimating the Dimension of a Model, 1978",
            "Burnham and Anderson, Model Selection and Multimodel Inference, 2002",
        ],
        workedExample:
            "For seven observations drawn near the quadratic 2 minus 1.2x plus 0.5x squared, degree zero has a large residual sum and a high BIC. Degrees one and two cut the residual sharply; degree three and four lower it only a little while adding parameters. With n equal to seven the log n penalty is about 1.95 per parameter, so the quadratic wins.",
    },
    id: "bayesian-information-criterion",
    name: "Bayesian Information Criterion",
    category: "statistics-probability",
    complexity: { time: "O(maxDegree * n * degree^2)", space: "O(degree^2)" },
    defaultInput: {
        x: [0, 1, 2, 3, 4, 5, 6],
        y: [2.12, 1.42, 1.55, 2.37, 4.09, 6.44, 9.74],
        maxDegree: 4,
    },
    visualType: "array",
    run,
    pseudocode: [
        "list the candidate polynomial degrees",
        "for each degree build the normal equations of least squares",
        "solve for the fitted coefficients",
        "compute the residual sum of squares and maximized log-likelihood",
        "score the model as minus two log-likelihood plus k log n",
        "track the candidate with the smallest score",
        "done: report the best degree and all scores",
    ],
};

export default module;

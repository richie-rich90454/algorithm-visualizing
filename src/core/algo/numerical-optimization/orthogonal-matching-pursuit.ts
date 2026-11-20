/**
 * orthogonal-matching-pursuit.ts - Orthogonal Matching Pursuit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Orthogonal Matching Pursuit (OMP) recovers a sparse signal from linear
 * measurements y = A x. Starting with an empty support and residual y, it
 * repeatedly selects the dictionary atom most correlated with the residual,
 * adds that atom to the support, and re-solves a least-squares problem using
 * every selected atom. Re-fitting on the whole support, rather than keeping old
 * coefficients fixed, is what makes the method orthogonal: the new residual is
 * perpendicular to all chosen atoms. It stops when the residual is small or
 * the sparsity budget is spent.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * m * n + k^3) for k selected atoms from m measurements and n atoms
 *   Space: O(m * n + k^2) for the dictionary and the least-squares system
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the coefficient vector, one per dictionary atom.
 *   - The atom just added to the support is highlighted yellow.
 *   - The final frame reports the support, coefficients, and residual norm.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface OmpInput {
    A?: number[][];
    y?: number[];
    K?: number;
    tol?: number;
}

function dot(a: number[], x: number[]): number {
    return a.reduce((sum, v, j) => sum + v * (x[j] ?? 0), 0);
}

/** Solve a small dense linear system by Gaussian elimination with partial pivoting. */
function solveLinear(M: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const a = M.map((row, i) => [...row, rhs[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(a[r]![col] ?? 0) > Math.abs(a[pivot]![col] ?? 0)) pivot = r;
        }
        if (Math.abs(a[pivot]![col] ?? 0) < 1e-12) {
            return Array.from({ length: n }, () => 0);
        }
        [a[col], a[pivot]] = [a[pivot]!, a[col]!];
        for (let r = col + 1; r < n; r += 1) {
            const factor = (a[r]![col] ?? 0) / (a[col]![col] ?? 0);
            for (let c = col; c <= n; c += 1) {
                a[r]![c] = (a[r]![c] ?? 0) - factor * (a[col]![c] ?? 0);
            }
        }
    }
    const x = Array.from({ length: n }, () => 0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let sum = a[i]![n] ?? 0;
        for (let j = i + 1; j < n; j += 1) {
            sum -= (a[i]![j] ?? 0) * (x[j] ?? 0);
        }
        x[i] = sum / (a[i]![i] ?? 1);
    }
    return x;
}

function makeBars(coeffs: number[], highlight: number, done: boolean): VisualEntity[] {
    return coeffs.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `a${i}: ${value.toFixed(4)}`,
        value,
        state: done ? "sorted" as EntityState : i === highlight ? "comparing" as EntityState : "idle" as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, coefficient: value },
    }));
}

/** The orthogonal matching pursuit generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as OmpInput | null) ?? {};
    const A: number[][] = Array.isArray(task.A) && task.A.length > 0
        ? task.A
        : [
              [1, 0, 0, 0, 0.5, 0.5],
              [0, 1, 0, 0, 0.5, -0.5],
              [0, 0, 1, 0, 0.5, 0.5],
              [0, 0, 0, 1, 0.5, -0.5],
          ];
    const m = A.length;
    const n = A[0]?.length ?? 1;
    const y: number[] = Array.isArray(task.y) && task.y.length === m ? task.y : [1.5, 0.5, 1.5, 0.5];
    const K = Math.max(1, Math.min(Math.min(n, m), Math.floor(task.K ?? 2)));
    const tol = typeof task.tol === "number" && task.tol > 0 ? task.tol : 1e-8;
    const columns = Array.from({ length: n }, (_, j) => A.map((row) => row[j] ?? 0));
    const norms = columns.map((col) => Math.sqrt(dot(col, col)));
    const support: number[] = [];
    let coeffs = Array.from({ length: n }, () => 0);
    let residual = [...y];
    let step = 0;

    const residualNorm = (r: number[]) => Math.sqrt(r.reduce((sum, v) => sum + v * v, 0));
    const meta = (iteration: number, chosen: number, correlations: number[], done: boolean) => ({
        m,
        n,
        K,
        iteration,
        support: [...support],
        chosenAtom: chosen,
        correlations: correlations.map((c) => Number(c.toFixed(6))),
        coefficients: [...coeffs],
        residual: residualNorm(residual),
        done,
    });

    yield {
        stepNumber: step++,
        entities: makeBars(coeffs, -1, false),
        edges: [],
        description: `Recovering a ${K}-sparse signal from ${m} measurements over ${n} dictionary atoms.`,
        codeLineNumber: 0,
        layout: "array",
        meta: meta(0, -1, [], false),
    };

    for (let k = 0; k < K; k += 1) {
        const correlations = columns.map((col, j) =>
            norms[j]! > 1e-15 ? Math.abs(dot(col, residual)) / norms[j]! : 0,
        );
        let chosen = -1;
        for (let j = 0; j < n; j += 1) {
            if (support.includes(j)) continue;
            if (chosen === -1 || (correlations[j] ?? 0) > (correlations[chosen] ?? 0)) chosen = j;
        }
        if (chosen === -1) break;
        support.push(chosen);
        const gram = support.map((i) => support.map((j) => dot(columns[i]!, columns[j]!)));
        const rhs = support.map((i) => dot(columns[i]!, y));
        const solved = solveLinear(gram, rhs);
        coeffs = Array.from({ length: n }, () => 0);
        for (let s = 0; s < support.length; s += 1) {
            coeffs[support[s]!] = solved[s] ?? 0;
        }
        residual = y.map((yi, i) => yi - support.reduce((sum, j, s) => sum + (solved[s] ?? 0) * (columns[j]![i] ?? 0), 0));
        yield {
            stepNumber: step++,
            entities: makeBars(coeffs, chosen, false),
            edges: [],
            description: `Step ${k + 1}: selected atom ${chosen} with correlation ${(correlations[chosen] ?? 0).toFixed(4)}; support {${support.join(", ")}}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: meta(k + 1, chosen, correlations, false),
        };
        if (residualNorm(residual) <= tol) break;
    }

    yield {
        stepNumber: step,
        entities: makeBars(coeffs, -1, true),
        edges: [],
        description: `OMP found support {${support.join(", ")}} with residual ${residualNorm(residual).toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: meta(support.length, -1, [], true),
    };
}

/** The orthogonal matching pursuit module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "OMP builds a sparse explanation of a signal one atom at a time. It picks whichever dictionary atom best matches what is still unexplained, then refits all chosen atoms to the original measurement so earlier choices can be corrected. Because it re-solves on the full support each time, the leftover error is orthogonal to everything selected so far, which makes the selection greedy but the fit exact on the chosen set.",
        invariants: [
            "Once an atom enters the support it is never removed.",
            "After each least-squares refit the residual is orthogonal to every selected atom.",
            "The correlation used for selection is normalized by each atom's norm.",
        ],
        correctness:
            "Selecting the largest normalized correlation chooses the atom that explains the most remaining energy per unit atom length. Re-solving the least-squares problem on the support makes the residual orthogonal to the span of the selected atoms by the normal equations, so no chosen atom can explain any remaining error. If the true signal is sparse in the dictionary and the dictionary satisfies a restricted isometry or incoherence condition, the largest correlation at each step belongs to a true support element, and OMP recovers the correct support and coefficients; the residual then vanishes for exact measurements.",
        complexityRationale:
            "Correlating every atom with the residual is O(m n). The k-th least-squares step builds a k by k Gram matrix in O(k^2 m) and solves it in O(k^3). Over k atoms the dominant costs are O(k m n + k^3) time and O(m n + k^2) space for the dictionary and small systems.",
        uses: [
            "Compressed sensing and sparse signal recovery",
            "Dictionary learning and image denoising",
            "Feature selection in high-dimensional regression",
        ],
        references: [
            "Tropp and Gilbert, Signal Recovery From Random Measurements Via Orthogonal Matching Pursuit, 2007",
            "Mallat and Zhang, Matching Pursuits With Time-Frequency Dictionaries, 1993",
        ],
        workedExample:
            "With a dictionary containing the four coordinate axes and two balanced atoms, measuring y = (1.5, 0.5, 1.5, 0.5) equals two copies of the balanced atom plus one copy of the signed one. OMP first picks the most correlated balanced atom, refits, then picks the signed atom, and the residual drops to zero, recovering coefficients 2 and 1 on that support.",
    },
    id: "orthogonal-matching-pursuit",
    name: "Orthogonal Matching Pursuit (OMP)",
    category: "numerical-optimization",
    complexity: { time: "O(k * m * n + k^3)", space: "O(m * n + k^2)" },
    defaultInput: {
        A: [
            [1, 0, 0, 0, 0.5, 0.5],
            [0, 1, 0, 0, 0.5, -0.5],
            [0, 0, 1, 0, 0.5, 0.5],
            [0, 0, 0, 1, 0.5, -0.5],
        ],
        y: [1.5, 0.5, 1.5, 0.5],
        K: 2,
        tol: 1e-8,
    },
    visualType: "array",
    run,
    pseudocode: [
        "start with an empty support, zero coefficients, and residual equal to y",
        "for up to k selected atoms compute each atom's normalized correlation with the residual",
        "choose the unselected atom with the largest absolute correlation",
        "add it to the support and solve least squares on all selected atoms",
        "recompute the residual from the original measurement and new coefficients",
        "stop early when the residual norm is below the tolerance",
        "record the support, coefficients, and residual",
        "done: report the recovered support and sparse signal",
    ],
};

export default module;

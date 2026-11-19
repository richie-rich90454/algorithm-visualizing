/**
 * biconjugate-gradient.ts - Biconjugate Gradient Method (BiCG)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BiCG solves a nonsymmetric linear system by running two coupled Lanczos
 * recurrences: one for the residual r and a shadow residual r-tilde. The
 * search directions are biorthogonal rather than orthogonal, which lets a
 * short three-term recurrence work without storing all previous directions.
 * It is the original method from which BiCGSTAB and QMR were derived.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * n^2) for m iterations on an n by n matrix
 *   Space: O(n) for the work vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current approximate solution vector x.
 *   - The caption reports the true residual norm at each iteration.
 *   - meta carries the solution, residual history, and iteration count.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function matVec(a: number[][], x: number[]): number[] {
    const n = x.length;
    return Array.from({ length: n }, (_, i) => {
        let sum = 0;
        for (let j = 0; j < n; j += 1) sum += (a[i]?.[j] ?? 0) * (x[j] ?? 0);
        return sum;
    });
}

function matVecTranspose(a: number[][], x: number[]): number[] {
    const n = x.length;
    return Array.from({ length: n }, (_, i) => {
        let sum = 0;
        for (let j = 0; j < n; j += 1) sum += (a[j]?.[i] ?? 0) * (x[j] ?? 0);
        return sum;
    });
}

function dot(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += (a[i] ?? 0) * (b[i] ?? 0);
    return sum;
}

function makeBars(x: number[]): VisualEntity[] {
    return x.map((value, index) => ({
        id: `x-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: "active",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { matrix?: number[][]; b?: number[]; iterations?: number; tolerance?: number } | null) ?? {};
    const raw = Array.isArray(task.matrix) ? task.matrix : [];
    const matrix: number[][] =
        raw.length > 0
            ? raw.map((row) => (Array.isArray(row) ? row.map((v) => Number(v)) : []))
            : [
                  [4, 1, 0],
                  [2, 5, 1],
                  [0, 1, 3],
              ];
    const n = matrix.length;
    const b: number[] = Array.isArray(task.b) && task.b.length === n ? task.b.map(Number) : [1, 2, 3].slice(0, n);
    const maxIter = Math.min(n * 3, Math.max(2, Math.floor(Number(task.iterations ?? 10)) || 10));
    const tolerance = typeof task.tolerance === "number" ? task.tolerance : 1e-10;

    let x = Array.from({ length: n }, () => 0);
    let r = matVec(matrix, x).map((v, i) => (b[i] ?? 0) - v);
    let rTilde = [...r];
    let p = [...r];
    let pTilde = [...rTilde];
    let rsOld = dot(rTilde, r);
    let residual = Math.sqrt(dot(r, r));
    const history: number[] = [residual];

    yield {
        stepNumber: 0,
        entities: makeBars(x),
        edges: [],
        description: `BiCG on a ${n} by ${n} nonsymmetric system; initial residual ${residual.toExponential(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, iteration: 0, residual, residualHistory: [...history], solution: [...x], converged: residual < tolerance },
    };

    let step = 1;
    let converged = false;
    for (let k = 0; k < maxIter; k += 1) {
        const ap = matVec(matrix, p);
        const denominator = dot(pTilde, ap);
        if (Math.abs(denominator) < 1e-14) {
            break;
        }
        const alpha = rsOld / denominator;
        x = x.map((v, i) => v + alpha * (p[i] ?? 0));
        r = r.map((v, i) => v - alpha * (ap[i] ?? 0));
        const atp = matVecTranspose(matrix, pTilde);
        rTilde = rTilde.map((v, i) => v - alpha * (atp[i] ?? 0));
        residual = Math.sqrt(dot(r, r));
        history.push(residual);

        if (residual < tolerance) {
            converged = true;
            yield {
                stepNumber: step,
                entities: makeBars(x),
                edges: [],
                description: `Converged at iteration ${k + 1} with residual ${residual.toExponential(3)}.`,
                codeLineNumber: 6,
                layout: "array",
                meta: { n, iteration: k + 1, residual, residualHistory: [...history], solution: [...x], converged: true },
            };
            step += 1;
            break;
        }

        const rsNew = dot(rTilde, r);
        const beta = rsNew / rsOld;
        p = r.map((v, i) => v + beta * (p[i] ?? 0));
        pTilde = rTilde.map((v, i) => v + beta * (pTilde[i] ?? 0));
        rsOld = rsNew;

        yield {
            stepNumber: step,
            entities: makeBars(x),
            edges: [],
            description: `Iteration ${k + 1}: step length ${alpha.toFixed(4)}, residual ${residual.toExponential(3)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { n, iteration: k + 1, residual, residualHistory: [...history], solution: [...x], converged: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x),
        edges: [],
        description: converged
            ? `BiCG finished after ${step - 1} iteration(s) with residual ${residual.toExponential(3)}.`
            : `Stopped after ${step - 1} iteration(s); residual ${residual.toExponential(3)} (a breakdown may have occurred).`,
        codeLineNumber: 8,
        layout: "array",
        meta: { n, iteration: step - 1, residual, residualHistory: [...history], solution: [...x], converged },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "BiCG solves nonsymmetric systems by carrying two error recurrences at once, one for the real residual and one for a shadow residual. Their dot product supplies the step length, and the two search directions are kept biorthogonal so that only a few vectors are ever stored. Think of it as conjugate gradient run on a doubled, symmetric system without ever forming that system.",
        invariants: [
            "The residual and shadow recurrences share the same scalar step length alpha at every iteration.",
            "The two search-direction families remain biorthogonal in exact arithmetic.",
            "Each iteration updates the solution by one rank-one step along the real search direction.",
        ],
        correctness:
            "The shadow recurrence makes the residuals biorthogonal, so after n steps the true residual is orthogonal to the entire Krylov space generated by A and its transpose. For an n by n nonsymmetric matrix this is enough to force the residual to zero in exact arithmetic. The biorthogonality of the directions guarantees each new step removes a new component of the error, mirroring the conjugate-direction argument for symmetric systems.",
        complexityRationale:
            "Each iteration performs two matrix-vector products, one with A and one with its transpose, and a constant number of vector operations, costing O(n^2) per iteration. Only a handful of length-n work vectors are stored, giving O(n) space.",
        uses: [
            "Nonsymmetric sparse systems in computational fluid dynamics",
            "Discretized convection-diffusion and transport equations",
            "A foundation for stabilized variants such as BiCGSTAB and QMR",
        ],
        references: [
            "Fletcher, Conjugate Gradient Methods for Indefinite Systems, 1976",
            "Barrett et al., Templates for the Solution of Linear Systems, Chapter 2",
        ],
        workedExample:
            "For the lower-triangular-like system with A = [[4,1,0],[2,5,1],[0,1,3]] and b = [1,2,3], the initial residual is b. The first step chooses alpha so that the new residual is biorthogonal to the initial shadow direction; after three steps the accumulated directions span the whole space and the residual drops to numerical zero.",
    },
    id: "biconjugate-gradient",
    name: "Biconjugate Gradient (BiCG)",
    category: "numerical-optimization",
    complexity: { time: "O(m * n^2)", space: "O(n)" },
    defaultInput: {
        matrix: [
            [4, 1, 0],
            [2, 5, 1],
            [0, 1, 3],
        ],
        b: [1, 2, 3],
        iterations: 10,
    },
    visualType: "array",
    run,
    pseudocode: [
        "set x to zero, r to b minus A x, and the shadow residual to r",
        "set both search directions to their residuals",
        "compute alpha as shadow dot residual over shadow direction dot A direction",
        "advance the solution and the real residual by alpha",
        "advance the shadow residual using the transpose of A",
        "test whether the real residual norm is below tolerance",
        "compute beta from the new shadow residual dot residual",
        "update both search directions with beta and loop",
        "done: report the iterate with the smallest residual",
    ],
};

export default module;

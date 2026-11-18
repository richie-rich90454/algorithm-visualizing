/**
 * l-bfgs.ts - Limited-Memory BFGS on a Quadratic Objective
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * L-BFGS approximates the inverse Hessian using only the last m pairs of
 * position and gradient changes (s, y). The two-loop recursion applies that
 * implicit inverse to the gradient to get a descent direction, and an exact
 * line step for a quadratic function moves to the next iterate. Compared with
 * full BFGS it stores O(m * n) numbers instead of an n-by-n matrix.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * n) per iteration for the two-loop recursion
 *   Space: O(m * n) for the stored correction pairs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per coordinate shows the current iterate.
 *   - Bars turn active while a step is taken and green at convergence.
 *   - Metadata reports the objective, gradient norm, and iterate values.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface LbfgsInput {
    H?: number[][];
    b?: number[];
    x0?: number[];
    m?: number;
    maxIterations?: number;
    tolerance?: number;
}

function matVec(H: number[][], x: number[]): number[] {
    return H.map((row) => row.reduce((sum, hij, j) => sum + hij * (x[j] ?? 0), 0));
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
}

function norm(a: number[]): number {
    return Math.sqrt(dot(a, a));
}

function makeBars(x: number[], converged: boolean, active: boolean): VisualEntity[] {
    return x.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: (converged ? "sorted" : active ? "comparing" : "idle") as "sorted" | "comparing" | "idle",
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, coordinate: index, value },
    }));
}

/** The L-BFGS generator for a quadratic objective. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LbfgsInput | null) ?? {};
    const H = Array.isArray(task.H) && task.H.length > 0
        ? task.H.map((row) => [...row])
        : [
              [4, 1],
              [1, 3],
          ];
    const n = H.length;
    const b = Array.isArray(task.b) && task.b.length === n ? [...task.b] : [1, 2].slice(0, n);
    let x = Array.isArray(task.x0) && task.x0.length === n
        ? [...task.x0]
        : Array.from({ length: n }, () => 0);
    const m = Math.min(20, Math.max(1, Math.floor(Number(task.m ?? 5)) || 5));
    const maxIterations = Math.min(500, Math.max(1, Math.floor(Number(task.maxIterations ?? 100)) || 100));
    const tolerance = Math.max(1e-14, Number(task.tolerance ?? 1e-9));

    const gradOf = (v: number[]) => matVec(H, v).map((hx, i) => hx - (b[i] ?? 0));
    const fOf = (v: number[]) => 0.5 * dot(v, matVec(H, v)) - dot(b, v);
    const sList: number[][] = [];
    const yList: number[][] = [];
    const rhoList: number[] = [];

    let g = gradOf(x);
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(x, false, false),
        edges: [],
        description: `Minimizing a ${n}-dimensional quadratic with L-BFGS (memory m = ${m}); initial gradient norm ${norm(g).toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, x: [...x], f: fOf(x), gradNorm: norm(g), iteration: 0, converged: false },
    };
    step += 1;

    let converged = norm(g) < tolerance;
    for (let k = 0; k < maxIterations && !converged; k += 1) {
        // Two-loop recursion to form the search direction p = -H_k^{-1} g.
        const q = [...g];
        const alphas = new Array<number>(sList.length).fill(0);
        for (let i = sList.length - 1; i >= 0; i -= 1) {
            alphas[i] = rhoList[i]! * dot(sList[i]!, q);
            const ai = alphas[i]!;
            const yi = yList[i]!;
            for (let j = 0; j < n; j += 1) q[j] = q[j]! - ai * yi[j]!;
        }
        let r = [...q];
        if (sList.length > 0) {
            const sLast = sList[sList.length - 1]!;
            const yLast = yList[yList.length - 1]!;
            const sy = dot(sLast, yLast);
            const yy = dot(yLast, yLast);
            if (yy > 0) {
                const gamma = sy / yy;
                r = r.map((v) => gamma * v);
            }
        }
        for (let i = 0; i < sList.length; i += 1) {
            const beta = rhoList[i]! * dot(yList[i]!, r);
            const factor = alphas[i]! - beta;
            const si = sList[i]!;
            for (let j = 0; j < n; j += 1) r[j] = r[j]! + factor * si[j]!;
        }
        const p = r.map((v) => -v);

        // Exact line search for a quadratic: minimize f(x + alpha p).
        const Hp = matVec(H, p);
        const denom = dot(p, Hp);
        const alpha = denom > 0 ? -dot(g, p) / denom : 0;
        const s = p.map((v) => alpha * v);
        const xNew = x.map((v, i) => v + (s[i] ?? 0));
        const gNew = gradOf(xNew);
        const y = gNew.map((v, i) => v - g[i]!);

        const sy = dot(s, y);
        if (sy > 1e-16) {
            sList.push(s);
            yList.push(y);
            rhoList.push(1 / sy);
            if (sList.length > m) {
                sList.shift();
                yList.shift();
                rhoList.shift();
            }
        }

        x = xNew;
        g = gNew;
        converged = norm(g) < tolerance;
        yield {
            stepNumber: step,
            entities: makeBars(x, converged, !converged),
            edges: [],
            description: `Iteration ${k + 1}: objective ${fOf(x).toFixed(8)}, gradient norm ${norm(g).toExponential(2)}${converged ? " - converged" : ""}.`,
            codeLineNumber: converged ? 5 : 2,
            layout: "array",
            meta: {
                n,
                x: [...x],
                f: fOf(x),
                gradNorm: norm(g),
                iteration: k + 1,
                converged,
                storedPairs: sList.length,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, converged, false),
        edges: [],
        description: converged
            ? `Converged to x = [${x.map((v) => v.toFixed(6)).join(", ")}] with objective ${fOf(x).toFixed(10)}.`
            : `Reached the iteration cap; best objective ${fOf(x).toFixed(8)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, x: [...x], f: fOf(x), gradNorm: norm(g), iteration: maxIterations, converged, done: true },
    };
}

/** The L-BFGS module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Quasi-Newton methods build up an approximation of the curvature of a function using past gradients instead of computing second derivatives. L-BFGS keeps only a short history of position and gradient changes and reconstructs the inverse curvature on the fly with the two-loop recursion, which makes each step cheap and memory small.",
        invariants: [
            "Each stored pair (s, y) has a positive inner product, so the implicit Hessian approximation stays positive definite.",
            "The two-loop recursion applies the same inverse-Hessian approximation as full BFGS using only stored pairs.",
            "The line step uses the exact curvature p^T H p for this quadratic objective.",
        ],
        correctness:
            "The two-loop recursion is algebraically equivalent to applying the product of BFGS update matrices in reverse, so the direction is a scaled member of the BFGS descent family and satisfies g^T p < 0. For a positive-definite quadratic, the exact line search moves to the minimum along that direction, and the curvature condition guarantees steady convergence to the unique minimizer where the gradient vanishes.",
        complexityRationale:
            "The recursion performs O(m) dot products of length n per loop, giving O(m n) per iteration. Storage is m pairs of n-vectors, O(m n), independent of the number of iterations.",
        uses: [
            "Training logistic regression and other differentiable models",
            "Large-scale parameter estimation where storing a Hessian is impossible",
            "Unconstrained nonlinear optimization in scientific software",
        ],
        references: [
            "Liu and Nocedal, On the Limited Memory BFGS Method for Large Scale Optimization, 1989",
            "Nocedal and Wright, Numerical Optimization, Chapter 7",
        ],
        workedExample:
            "For H = [[4,1],[1,3]] and b = [1,2] from x0 = [0,0], the exact minimizer is the solution of Hx = b, about [0.0909, 0.6364]. L-BFGS builds curvature from successive gradients and reaches that point with the gradient norm driven below tolerance.",
    },
    id: "l-bfgs",
    name: "L-BFGS (Limited-Memory BFGS)",
    category: "numerical-optimization",
    complexity: { time: "O(m * n) per iteration", space: "O(m * n)" },
    defaultInput: {
        H: [[4, 1], [1, 3]],
        b: [1, 2],
        x0: [0, 0],
        m: 5,
        maxIterations: 100,
        tolerance: 1e-9,
    },
    visualType: "array",
    run,
    pseudocode: [
        "start from x0 and compute the gradient g",
        "loop from newest stored pair down to oldest to scale g",
        "scale by the latest curvature ratio and sweep forward",
        "set the search direction to the negative result",
        "take the exact step length for the quadratic",
        "store the new position and gradient change pair",
        "repeat until the gradient norm is below tolerance",
        "done: report the minimizing iterate",
    ],
};

export default module;

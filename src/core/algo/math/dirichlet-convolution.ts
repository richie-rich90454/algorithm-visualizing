/**
 * dirichlet-convolution.ts - Dirichlet Convolution of Arithmetic Functions
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Dirichlet convolution of two arithmetic functions f and g is
 * (f * g)(n) = sum over d dividing n of f(d) * g(n/d). This module computes
 * the convolution table up to a bound N, showing each divisor contribution.
 * Classic identities include 1 * mu = epsilon and phi * 1 = id.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N * sqrt(N)) enumerating divisors for each n
 *   Space: O(N) for the result table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid of cells shows the current n and each divisor contribution.
 *   - The final frame stores the convolution table in meta.table.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(values: number[], labels: string[], active = -1): VisualEntity[] {
    return values.map((value, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: labels[i] ?? String(value),
        value,
        state: (i === active ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; f?: number[]; g?: number[] } | null) ?? {};
    const N = typeof task.n === "number" && task.n >= 1 && task.n <= 200 ? Math.floor(task.n) : 12;
    const f: number[] = task.f ?? Array.from({ length: N + 1 }, (_, i) => (i >= 1 ? 1 : 0));
    const g: number[] = task.g ?? Array.from({ length: N + 1 }, (_, i) => i);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([N], [`N=${N}`]),
        edges: [],
        description: `Computing the Dirichlet convolution of f and g for n = 1 to ${N}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, N },
    };
    step += 1;

    const h: number[] = Array(N + 1).fill(0);
    for (let n = 1; n <= N; n += 1) {
        let total = 0;
        const divisors: number[] = [];
        for (let d = 1; d <= n; d += 1) {
            if (n % d !== 0) continue;
            divisors.push(d);
            const fd = f[d] ?? 0;
            const gd = g[n / d] ?? 0;
            const contribution = fd * gd;
            total += contribution;
            yield {
                stepNumber: step,
                entities: makeCells(
                    [n, d, n / d, fd, gd, contribution],
                    [`n=${n}`, `d=${d}`, `n/d=${n / d}`, `f=${fd}`, `g=${gd}`, `f*g=${contribution}`],
                    5,
                ),
                edges: [],
                description: `n=${n}: divisor d=${d} contributes f(${d})*g(${n / d}) = ${fd}*${gd} = ${contribution}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { step, n, d, contribution, partial: total },
            };
            step += 1;
        }
        h[n] = total;
    }

    yield {
        stepNumber: step,
        entities: makeCells(
            h.slice(1),
            h.slice(1).map((v, i) => `h(${i + 1})=${v}`),
        ),
        edges: [],
        description: `Convolution complete for n = 1 to ${N}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { step, N, table: h.slice(1), h1: h[1], hN: h[N] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Dirichlet convolution is a way of multiplying arithmetic functions that mirrors multiplying Dirichlet series. Instead of multiplying values at the same argument, you sum over every way of splitting n into a product d times (n/d), pairing f on the first factor with g on the second. It is the algebraic backbone behind identities such as phi * 1 = id.",
        invariants: [
            "The sum runs exactly over all positive divisors d of n.",
            "Each divisor contributes f(d) times g(n/d), and contributions are added into h(n).",
            "Convolution is commutative and associative, with the function epsilon as identity.",
        ],
        correctness:
            "By definition (f * g)(n) is the sum over divisors d of n of f(d)g(n/d). The loop enumerates precisely those divisors because d divides n if and only if n % d = 0, and it adds exactly the required product for each. Summing all of them produces h(n) equal to the definition for every n up to N, so the returned table is the Dirichlet convolution.",
        complexityRationale:
            "For each n from 1 to N the loop scans d from 1 to n and keeps only divisors, costing O(n) per n and O(N^2) total in this straightforward form. The result table uses O(N) space.",
        uses: [
            "Deriving identities among number-theoretic functions such as mobius and phi",
            "Multiplying Dirichlet series in analytic number theory",
            "Computing mobius inversion and divisor sums efficiently",
        ],
        references: [
            "Apostol, Introduction to Analytic Number Theory, Chapter 2",
            "Hardy and Wright, An Introduction to the Theory of Numbers, Section 16.6",
        ],
        workedExample:
            "Take f = 1 (the constant-one function) and g = phi. For n = 6 the divisors are 1, 2, 3, 6, giving phi(6) + phi(3) + phi(2) + phi(1) = 2 + 2 + 1 + 1 = 6, which is n. This illustrates the identity 1 * phi = id.",
    },
    id: "dirichlet-convolution",
    name: "Dirichlet Convolution",
    category: "math",
    complexity: { time: "O(N^2)", space: "O(N)" },
    defaultInput: { n: 12 },
    visualType: "grid",
    run,
    pseudocode: [
        "input bound N and functions f and g",
        "initialize result table h of zeros",
        "for each n from 1 to N",
        "for each divisor d of n add f(d)*g(n/d) to h(n)",
        "store the accumulated h(n)",
        "done: the convolution table h",
    ],
};

export default module;

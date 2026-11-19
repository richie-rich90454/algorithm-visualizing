/**
 * nash-equilibrium-support-enumeration.ts - Nash Equilibrium by Support Enumeration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Enumerates every equal-sized pair of row and column supports in a two-player
 * normal-form game. For each pair it solves the linear equations that make the
 * opponent indifferent among the supported pure strategies, checks that the
 * resulting mixed strategies are valid probabilities, and verifies that no
 * strategy outside the support gives a higher payoff. Surviving pairs are
 * mixed-strategy Nash equilibria.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^(m+n) * poly(m,n)) - exponentially many support pairs, each
 *          requiring a small Gaussian elimination
 *   Space: O(m + n + m*n) for the strategies and payoff matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid cell shows the payoff pair (row payoff, column payoff).
 *   - The support pair under test flashes YELLOW (active).
 *   - Cells belonging to a discovered equilibrium turn GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - A reported strategy is a probability distribution over its support.
 *   - No pure strategy outside the support yields a strictly better payoff.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function solveLinear(matrix: number[][], rhs: number[]): number[] | null {
    const n = rhs.length;
    if (n === 0) return [];
    const a = matrix.map((row, i) => [...row, rhs[i] as number]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(a[r]?.[col] ?? 0) > Math.abs(a[pivot]?.[col] ?? 0)) pivot = r;
        }
        if (Math.abs(a[pivot]?.[col] ?? 0) < 1e-10) return null;
        const tmp = a[col] as number[];
        a[col] = a[pivot] as number[];
        a[pivot] = tmp;
        const pivotRow = a[col] as number[];
        const factor = pivotRow[col] as number;
        for (let c = col; c <= n; c += 1) pivotRow[c] = (pivotRow[c] as number) / factor;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const f = a[r]?.[col] ?? 0;
            if (f === 0) continue;
            for (let c = col; c <= n; c += 1) {
                a[r]![c] = (a[r]?.[c] as number) - f * (pivotRow[c] as number);
            }
        }
    }
    return a.map((row) => row[n] as number);
}

function* combinations(n: number, k: number): Generator<number[], void, unknown> {
    function* build(start: number, chosen: number[]): Generator<number[], void, unknown> {
        if (chosen.length === k) {
            yield [...chosen];
            return;
        }
        for (let i = start; i < n; i += 1) {
            chosen.push(i);
            yield* build(i + 1, chosen);
            chosen.pop();
        }
    }
    yield* build(0, []);
}

function normalize(vector: number[]): number[] {
    const sum = vector.reduce((acc, v) => acc + v, 0);
    return sum === 0 ? vector.map(() => 1 / vector.length) : vector.map((v) => v / sum);
}

function makeCells(
    a: number[][],
    b: number[][],
    rows: number[],
    cols: number[],
    equilibriumCells: Set<string>,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < (a[i] as number[]).length; j += 1) {
            const inSupport = rows.includes(i) && cols.includes(j);
            let state: EntityState = "idle";
            if (equilibriumCells.has(`${i},${j}`)) state = "sorted";
            else if (inSupport) state = "active";
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: `${a[i]?.[j]},${b[i]?.[j]}`,
                value: a[i]?.[j] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, rowPayoff: a[i]?.[j] ?? 0, colPayoff: b[i]?.[j] ?? 0 },
            });
        }
    }
    return entities;
}

interface Equilibrium {
    p: number[];
    q: number[];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { A?: number[][]; B?: number[][] } | null) ?? {};
    const A: number[][] = Array.isArray(task.A)
        ? task.A.map((row) => [...row])
        : [
              [1, -1],
              [-1, 1],
          ];
    const B: number[][] = Array.isArray(task.B)
        ? task.B.map((row) => [...row])
        : [
              [-1, 1],
              [1, -1],
          ];
    const m = A.length;
    const n = m > 0 ? (A[0] as number[]).length : 0;
    const tol = 1e-7;
    let step = 0;

    if (m === 0 || n === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Empty payoff matrices - there is no game to analyze.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: 0, cols: 0, tested: 0, found: 0, equilibriumRows: [], equilibriumCols: [] },
        };
        return;
    }

    const equilibria: Equilibrium[] = [];
    const equilibriumCells = new Set<string>();
    let tested = 0;

    yield {
        stepNumber: step,
        entities: makeCells(A, B, [], [], equilibriumCells),
        edges: [],
        description: `Enumerating equal-sized supports in a ${m} by ${n} normal-form game.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: m, cols: n, tested: 0, found: 0, equilibriumRows: [], equilibriumCols: [] },
    };
    step += 1;

    const maxK = Math.min(m, n);
    for (let k = 1; k <= maxK; k += 1) {
        const rowSupports = [...combinations(m, k)];
        const colSupports = [...combinations(n, k)];
        for (const I of rowSupports) {
            for (const J of colSupports) {
                tested += 1;
                // Solve the column mix that makes the row player indifferent on I.
                const qMatrix: number[][] = I.map((i) => [
                    ...J.map((j) => A[i]?.[j] ?? 0),
                    -1,
                ]);
                qMatrix.push([...J.map(() => 1), 0]);
                const qSolution = solveLinear(qMatrix, [...I.map(() => 0), 1]);
                let valid = qSolution !== null;
                let qFull = new Array<number>(n).fill(0);
                if (qSolution) {
                    const qj = qSolution.slice(0, k);
                    if (qj.some((value) => value < -tol)) valid = false;
                    const qNorm = normalize(qj.map((value) => Math.max(0, value)));
                    J.forEach((j, index) => {
                        qFull[j] = qNorm[index] ?? 0;
                    });
                }

                if (valid) {
                    const payoffsI = Array.from({ length: m }, (_v, i) =>
                        J.reduce((sum, j) => sum + ((A[i]?.[j] ?? 0) * (qFull[j] ?? 0)), 0),
                    );
                    const supportMin = Math.min(...I.map((i) => payoffsI[i] ?? 0));
                    const outsideMax = Math.max(
                        ...Array.from({ length: m }, (_v, i) => (I.includes(i) ? Number.NEGATIVE_INFINITY : (payoffsI[i] ?? 0))),
                    );
                    if (supportMin < outsideMax - tol) valid = false;
                }

                // Solve the row mix that makes the column player indifferent on J.
                let pFull = new Array<number>(m).fill(0);
                if (valid) {
                    const pMatrix: number[][] = J.map((j) => [
                        ...I.map((i) => B[i]?.[j] ?? 0),
                        -1,
                    ]);
                    pMatrix.push([...I.map(() => 1), 0]);
                    const pSolution = solveLinear(pMatrix, [...J.map(() => 0), 1]);
                    if (pSolution === null) valid = false;
                    else {
                        const pi = pSolution.slice(0, k);
                        if (pi.some((value) => value < -tol)) valid = false;
                        const pNorm = normalize(pi.map((value) => Math.max(0, value)));
                        I.forEach((i, index) => {
                            pFull[i] = pNorm[index] ?? 0;
                        });
                    }
                }

                if (valid) {
                    const payoffsJ = Array.from({ length: n }, (_v, j) =>
                        I.reduce((sum, i) => sum + ((B[i]?.[j] ?? 0) * (pFull[i] ?? 0)), 0),
                    );
                    const supportMin = Math.min(...J.map((j) => payoffsJ[j] ?? 0));
                    const outsideMax = Math.max(
                        ...Array.from({ length: n }, (_v, j) => (J.includes(j) ? Number.NEGATIVE_INFINITY : (payoffsJ[j] ?? 0))),
                    );
                    if (supportMin < outsideMax - tol) valid = false;
                }

                if (valid) {
                    const duplicate = equilibria.some(
                        (eq) =>
                            eq.p.every((v, i) => Math.abs(v - (pFull[i] ?? 0)) < 1e-6) &&
                            eq.q.every((v, j) => Math.abs(v - (qFull[j] ?? 0)) < 1e-6),
                    );
                    if (!duplicate) {
                        equilibria.push({ p: pFull, q: qFull });
                        for (const i of I) {
                            for (const j of J) equilibriumCells.add(`${i},${j}`);
                        }
                    }
                }

                yield {
                    stepNumber: step,
                    entities: makeCells(A, B, I, J, equilibriumCells),
                    edges: [],
                    description: `Tested support rows ${I.join(",")} and columns ${J.join(",")}; ${equilibria.length} equilibrium(s) found.`,
                    codeLineNumber: valid ? 7 : 5,
                    layout: "grid",
                    meta: {
                        rows: m,
                        cols: n,
                        tested,
                        found: equilibria.length,
                        equilibriumRows: equilibria[0]?.p ?? [],
                        equilibriumCols: equilibria[0]?.q ?? [],
                    },
                };
                step += 1;
            }
        }
    }

    const first = equilibria[0];
    yield {
        stepNumber: step,
        entities: makeCells(A, B, [], [], equilibriumCells),
        edges: [],
        description: `Done: enumerated ${tested} support pairs and found ${equilibria.length} Nash equilibrium/equilibria.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: m,
            cols: n,
            tested,
            found: equilibria.length,
            equilibriumRows: first?.p ?? [],
            equilibriumCols: first?.q ?? [],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A mixed-strategy equilibrium is described by which pure strategies each player uses with positive probability, called the support. Fix a support pair and the equilibrium conditions become linear equations: each supported strategy must give the same payoff, and no excluded strategy may do better. Enumerate the supports, solve those equations, and keep the solutions that are genuine probabilities.",
        invariants: [
            "The two supports in a candidate pair have equal size.",
            "A reported mixed strategy sums to one and is nonnegative on its support.",
            "Every supported pure strategy yields at least as much as any excluded one.",
        ],
        correctness:
            "The Nash equilibrium conditions split into indifference on the support and no-profitable-deviation off it. For a fixed pair of supports, indifference is a linear system whose solution is unique when it is nonsingular. Checking nonnegativity and the off-support inequalities filters exactly the equilibria with that support, and enumerating all support pairs catches every nondegenerate equilibrium, so each reported pair satisfies the definition of a Nash equilibrium.",
        complexityRationale:
            "There are exponentially many equal-sized support pairs, up to the sum of binomial products, and each requires a Gaussian elimination of size at most min(m,n), giving exponential time overall; storage is linear in the game size plus the list of equilibria.",
        uses: [
            "Analyzing zero-sum and coordination games in economics",
            "Computing equilibrium strategies for small auction mechanisms",
            "A teaching example connecting linear algebra and game theory",
        ],
        references: [
            "Nash, Equilibrium Points in N-Person Games, 1950",
            "Osborne, An Introduction to Game Theory, Chapter 4",
        ],
        workedExample:
            "In matching pennies, the support pair with both rows and both columns makes the row player indifferent only when the column player mixes fifty-fifty, and vice versa, so the enumeration returns the single equilibrium where each player chooses heads with probability one half.",
    },
    id: "nash-equilibrium-support-enumeration",
    name: "Nash Equilibrium by Support Enumeration",
    category: "game",
    complexity: { time: "O(2^(m+n) poly(m,n))", space: "O(mn)" },
    defaultInput: {
        A: [
            [1, -1],
            [-1, 1],
        ],
        B: [
            [-1, 1],
            [1, -1],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for every support size from one to the smaller dimension",
        "choose each equal-sized pair of row and column supports",
        "solve for the column mix that equalizes row payoffs",
        "reject it if any probability is negative",
        "solve for the row mix that equalizes column payoffs",
        "reject it if any supported strategy is beaten from outside",
        "record the surviving strategy pair as an equilibrium",
        "done: report all discovered Nash equilibria",
    ],
};

export default module;

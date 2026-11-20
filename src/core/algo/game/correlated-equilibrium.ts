/**
 * correlated-equilibrium.ts - Correlated Equilibrium by Vertex Enumeration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A correlated equilibrium is a joint distribution over action profiles in
 * which no player wants to deviate after observing a recommended action. The
 * conditions are linear inequalities, so maximizing social welfare over them
 * is a linear program. This module solves that LP exactly by enumerating the
 * vertices of the feasible polytope and keeping the best feasible one.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(C^(N-1) * N^3) for N joint outcomes and C incentive constraints
 *   Space: O(N^2) for one linear system
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid cell is one action profile; its label shows probability.
 *   - Positive-probability outcomes are green, the rest idle.
 *   - Limits: two players with at most two actions each (N <= 4), exact
 *     arithmetic on small integer or decimal payoffs; no samples or noise.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Constraint = { coef: number[]; rhs: number };

function solveSystem(matrix: number[][], rhs: number[]): number[] | null {
    const n = rhs.length;
    const aug = matrix.map((row, i) => [...row, rhs[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r]?.[col] ?? 0) > Math.abs(aug[pivot]?.[col] ?? 0)) pivot = r;
        }
        if (Math.abs(aug[pivot]?.[col] ?? 0) < 1e-12) return null;
        const tmp = aug[col];
        aug[col] = aug[pivot] ?? [];
        aug[pivot] = tmp ?? [];
        const pivotRow = aug[col] ?? [];
        const divisor = pivotRow[col] ?? 1;
        for (let c = col; c <= n; c += 1) pivotRow[c] = (pivotRow[c] ?? 0) / divisor;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const row = aug[r] ?? [];
            const factor = row[col] ?? 0;
            if (factor === 0) continue;
            for (let c = col; c <= n; c += 1) row[c] = (row[c] ?? 0) - factor * (pivotRow[c] ?? 0);
        }
    }
    return aug.map((row) => row[n] ?? 0);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { payoffA?: number[][]; payoffB?: number[][] } | null) ?? {};
    const payoffA = (task.payoffA ?? [[2, 0], [0, 1]]).map((row) => row.slice());
    const payoffB = (task.payoffB ?? [[1, 0], [0, 2]]).map((row) => row.slice());
    const n = payoffA.length;
    const m = n > 0 ? (payoffA[0]?.length ?? 0) : 0;
    if (n < 1 || n > 2 || m < 1 || m > 2 || payoffB.length !== n || payoffB.some((r) => r.length !== m)) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Correlated equilibrium enumeration requires two players with one or two actions each and matching payoff shapes.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: 1, cols: 1, converged: false, welfare: 0 },
        };
        return;
    }
    const total = n * m;
    const index = (i: number, j: number): number => i * m + j;
    const constraints: Constraint[] = [];
    for (let k = 0; k < total; k += 1) {
        const coef = new Array<number>(total).fill(0);
        coef[k] = -1;
        constraints.push({ coef, rhs: 0 });
    }
    for (let i = 0; i < n; i += 1) {
        for (let deviation = 0; deviation < n; deviation += 1) {
            if (deviation === i) continue;
            const coef = new Array<number>(total).fill(0);
            for (let j = 0; j < m; j += 1) coef[index(i, j)] = (payoffA[deviation]?.[j] ?? 0) - (payoffA[i]?.[j] ?? 0);
            constraints.push({ coef, rhs: 0 });
        }
    }
    for (let j = 0; j < m; j += 1) {
        for (let deviation = 0; deviation < m; deviation += 1) {
            if (deviation === j) continue;
            const coef = new Array<number>(total).fill(0);
            for (let i = 0; i < n; i += 1) coef[index(i, j)] = (payoffB[i]?.[deviation] ?? 0) - (payoffB[i]?.[j] ?? 0);
            constraints.push({ coef, rhs: 0 });
        }
    }
    const welfareOf = (p: number[]): number => {
        let welfare = 0;
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < m; j += 1) {
                welfare += (p[index(i, j)] ?? 0) * ((payoffA[i]?.[j] ?? 0) + (payoffB[i]?.[j] ?? 0));
            }
        }
        return welfare;
    };
    const feasible = (p: number[]): boolean =>
        p.every((x) => x >= -1e-9) &&
        constraints.every((c) => c.coef.reduce((acc, x, k) => acc + x * (p[k] ?? 0), 0) <= 1e-9);

    const choices: number[][] = [];
    const pick = (start: number, chosen: number[]): void => {
        if (chosen.length === total - 1) {
            choices.push(chosen.slice());
            return;
        }
        for (let c = start; c < constraints.length; c += 1) {
            chosen.push(c);
            pick(c + 1, chosen);
            chosen.pop();
        }
    };
    pick(0, []);

    const vertices: { p: number[]; welfare: number }[] = [];
    let best: number[] | null = null;
    let bestWelfare = -Infinity;
    for (const combo of choices) {
        const matrix = combo.map((c) => constraints[c]?.coef.slice() ?? []);
        const rhs = combo.map(() => 0);
        matrix.push(new Array<number>(total).fill(1));
        rhs.push(1);
        const candidate = solveSystem(matrix, rhs);
        if (!candidate || !feasible(candidate)) continue;
        const welfare = welfareOf(candidate);
        vertices.push({ p: candidate, welfare });
        if (welfare > bestWelfare + 1e-12) {
            bestWelfare = welfare;
            best = candidate;
        }
    }
    const answer = (best ?? new Array<number>(total).fill(0)).slice();
    if (best === null) answer[0] = 1;

    const makeEntities = (p: number[]): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < m; j += 1) {
                const probability = p[index(i, j)] ?? 0;
                entities.push({
                    id: `outcome-${i}-${j}`,
                    type: "cell" as const,
                    label: `(${i},${j}): ${probability.toFixed(2)}`,
                    value: probability,
                    state: probability > 1e-6 ? "sorted" : "idle",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: i, col: j, kind: "probability" },
                });
            }
        }
        return entities;
    };

    const makeFrame = (step: number, p: number[], candidateCount: number, indexLabel: string, codeLine: number, converged = false): VisualFrame => ({
        stepNumber: step,
        entities: makeEntities(p),
        edges: [],
        description: converged
            ? `Best correlated equilibrium pays welfare ${welfareOf(p).toFixed(2)} with probabilities ${p.map((x) => x.toFixed(2)).join("/")}; ${candidateCount} feasible vertices examined.`
            : `Vertex ${indexLabel}: probabilities ${p.map((x) => x.toFixed(2)).join("/")}, welfare ${welfareOf(p).toFixed(2)}.`,
        codeLineNumber: codeLine,
        layout: "grid",
        meta: {
            rows: n,
            cols: m,
            distribution: [...p],
            welfare: welfareOf(p),
            bestWelfare,
            feasibleVertices: vertices.length,
            candidatesExamined: candidateCount,
            converged,
        },
    });

    let step = 0;
    yield makeFrame(step++, new Array<number>(total).fill(1 / total), 0, "setup", 0);
    const limit = Math.min(vertices.length, 12);
    for (let v = 0; v < limit; v += 1) {
        const vertex = vertices[v];
        if (vertex) yield makeFrame(step++, vertex.p, v + 1, String(v + 1), 5);
    }
    yield makeFrame(step++, answer, vertices.length, "final", 7, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A trusted mediator privately recommends an action to each player. A recommendation is stable when, assuming the other player also follows the recommendation, switching action cannot improve your expected payoff. Those stability requirements are linear inequalities in the joint probabilities, so the best stable distribution is found at a corner of the feasible region.",
        invariants: [
            "Every candidate distribution is nonnegative and sums to one.",
            "No player has a profitable deviation from any recommended action.",
            "The optimum of a linear function over the polytope occurs at a vertex.",
        ],
        correctness:
            "Each constraint states that the expected gain from deviating, conditional on a received recommendation, is at most zero, which is exactly the definition of correlated equilibrium. The feasible set is a bounded polytope because probabilities are nonnegative and sum to one. A linear objective attains its maximum at some vertex, and enumerating every vertex by activating N independent constraints therefore examines the true optimum; any vertex kept has passed all inequalities.",
        complexityRationale:
            "With N joint outcomes and C incentive and nonnegativity constraints, the enumeration solves C choose N-1 linear systems, each costing O(N^3) by Gaussian elimination. For the supported two-by-two case this is a few dozen tiny systems, and only one N-dimensional vector and one system matrix are stored at a time.",
        uses: [
            "Analyzing mediation and recommendation mechanisms in electronic markets",
            "Traffic signals modeled as correlated recommendations at intersections",
            "Teaching the gap between Nash and correlated equilibrium",
        ],
        references: [
            "Aumann, Correlated Equilibrium as an Expression of Bayesian Rationality, Econometrica 55 (1987)",
            "Nisan, Roughgarden, Tardos, and Vazirani, Algorithmic Game Theory, chapter 3",
        ],
        workedExample:
            "In Battle of the Sexes the two pure outcomes where both attend the same event are correlated equilibria: a recommendation to attend opera leaves neither player wanting to switch. Putting all probability on one of those outcomes pays welfare three and satisfies every deviation inequality, so vertex enumeration returns one of them.",
    },
    id: "correlated-equilibrium",
    name: "Correlated Equilibrium (Vertex Enumeration)",
    category: "game",
    complexity: { time: "O(C^(N-1) * N^3)", space: "O(N^2)" },
    defaultInput: {
        payoffA: [[2, 0], [0, 1]],
        payoffB: [[1, 0], [0, 2]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build the incentive inequalities for both players",
        "add nonnegativity for every joint outcome",
        "add the constraint that probabilities sum to one",
        "enumerate subsets of active constraints of size N minus one",
        "solve each active system by Gaussian elimination",
        "discard solutions that violate any inequality",
        "score each feasible vertex by social welfare",
        "keep the best feasible vertex found",
        "report the optimal correlated equilibrium",
    ],
};

export default module;

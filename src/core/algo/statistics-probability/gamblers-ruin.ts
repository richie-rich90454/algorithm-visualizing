/**
 * gamblers-ruin.ts - Gambler's Ruin Probability via a Tridiagonal Solve
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A gambler starts with a dollars and stops on reaching either 0 (ruin) or a
 * target of N dollars. Each round gains one dollar with probability p or loses
 * one with probability q = 1 - p. The ruin probability r_i from each state i
 * satisfies r_i = q*r_(i-1) + p*r_(i+1) with r_0 = 1 and r_N = 0. Rearranged,
 * this is a tridiagonal linear system solved exactly here with the Thomas
 * algorithm; the answer is the component for the starting capital a.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) for a target of N dollars
 *   Space: O(N) for the tridiagonal coefficients and solution
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per capital state shows the current ruin probability estimate.
 *   - The boundary states 0 and N are fixed at 1 and 0.
 *   - Forward elimination and back substitution advance one state per frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function stateBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `i=${index}:${value.toFixed(3)}`,
        value,
        state: (done ? "sorted" : index === current ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, ruinProbability: value },
    }));
}

/** Closed-form ruin probability used as an independent check in the writeup. */
function closedForm(i: number, target: number, p: number): number {
    if (p === 0.5) {
        return (target - i) / target;
    }
    const ratio = (1 - p) / p;
    return (Math.pow(ratio, i) - Math.pow(ratio, target)) / (1 - Math.pow(ratio, target));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { capital?: number; target?: number; p?: number } | null) ?? {};
    const target = typeof task.target === "number" && Number.isInteger(task.target)
        ? Math.max(2, Math.min(40, task.target))
        : 10;
    const capital = typeof task.capital === "number" && Number.isInteger(task.capital)
        ? Math.max(1, Math.min(target - 1, task.capital))
        : Math.floor(target / 2);
    const p = typeof task.p === "number" && task.p > 0 && task.p < 1 ? task.p : 0.5;
    const q = 1 - p;

    // Unknowns r_1 .. r_(target-1). Equation i: -q*r_(i-1) + r_i - p*r_(i+1) = 0,
    // with the boundary contributions moved to the right-hand side.
    const n = target - 1;
    const lower = new Array<number>(n).fill(0);
    const diagonal = new Array<number>(n).fill(1);
    const upper = new Array<number>(n).fill(0);
    const rhs = new Array<number>(n).fill(0);
    for (let k = 0; k < n; k += 1) {
        lower[k] = k === 0 ? 0 : -q;
        upper[k] = k === n - 1 ? 0 : -p;
        rhs[k] = k === 0 ? q : 0;
    }

    const primeUpper = new Array<number>(n).fill(0);
    const primeRhs = new Array<number>(n).fill(0);
    const solution = new Array<number>(target + 1).fill(0);
    solution[0] = 1;
    solution[target] = 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: stateBars([1, ...new Array<number>(n).fill(0), 0], -1, false),
        edges: [],
        description: `Solving gambler's ruin for capital ${capital}, target ${target}, and win probability ${p}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { capital, target, p, q, phase: "setup", ruinProbability: 0 },
    };
    step += 1;

    if (n > 0) {
        const denom0 = diagonal[0] as number;
        primeUpper[0] = (upper[0] as number) / denom0;
        primeRhs[0] = (rhs[0] as number) / denom0;
        for (let k = 1; k < n; k += 1) {
            const denom = (diagonal[k] as number) - (lower[k] as number) * (primeUpper[k - 1] as number);
            primeUpper[k] = (upper[k] as number) / denom;
            primeRhs[k] = ((rhs[k] as number) - (lower[k] as number) * (primeRhs[k - 1] as number)) / denom;
            const visible = [1, ...primeRhs.slice(0, k + 1), ...new Array<number>(n - k - 1).fill(0), 0];
            yield {
                stepNumber: step,
                entities: stateBars(visible, k + 1, false),
                edges: [],
                description: `Forward elimination at state ${k + 1} updates the modified coefficients.`,
                codeLineNumber: 1,
                layout: "array",
                meta: { capital, target, p, q, phase: "eliminate", state: k + 1 },
            };
            step += 1;
        }

        solution[n] = primeRhs[n - 1];
        const partial = [1, ...primeRhs, solution[n]];
        yield {
            stepNumber: step,
            entities: stateBars(partial, n, false),
            edges: [],
            description: `Back substitution starts from state ${n} with value ${(solution[n] as number).toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { capital, target, p, q, phase: "back-start", state: n },
        };
        step += 1;

        for (let k = n - 2; k >= 0; k -= 1) {
            solution[k + 1] = (primeRhs[k] as number) - (primeUpper[k] as number) * (solution[k + 2] as number);
            const partialState = [1, ...solution.slice(1, k + 2), ...new Array<number>(n - k - 1).fill(0), 0];
            yield {
                stepNumber: step,
                entities: stateBars(partialState, k + 1, false),
                edges: [],
                description: `Back substitution recovers r_${k + 1} = ${(solution[k + 1] as number).toFixed(4)}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { capital, target, p, q, phase: "back", state: k + 1 },
            };
            step += 1;
        }
    }

    const ruin = solution[capital] ?? 0;
    const exact = closedForm(capital, target, p);
    yield {
        stepNumber: step,
        entities: stateBars(solution, -1, true),
        edges: [],
        description: `From capital ${capital}, ruin probability is ${ruin.toFixed(4)} (closed form ${exact.toFixed(4)}).`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            capital,
            target,
            p,
            q,
            phase: "done",
            ruinProbability: ruin,
            closedForm: exact,
            ruinProbabilities: solution,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of the gambler's capital as a random walk between two absorbing walls at zero and at the target. The chance of hitting zero before the target, viewed from each possible starting capital, forms a curve fixed at both ends. Every interior value is the weighted average of its two neighbors, which turns the whole curve into a small tridiagonal linear system that can be solved exactly in one forward and one backward sweep.",
        invariants: [
            "The ruin probability at zero is one and at the target is zero.",
            "Each interior value satisfies r_i = q*r_(i-1) + p*r_(i+1).",
            "For a fair game the solution is linear, r_i = (target - i)/target.",
        ],
        correctness:
            "Conditioning on the first round gives the recurrence r_i = q*r_(i-1) + p*r_(i+1), since a loss moves the state to i-1 and a win to i+1. With the two absorbing boundaries this is a nonsingular tridiagonal system. The Thomas algorithm performs Gaussian elimination specialized to that banded structure, so the back-substituted values are the exact solution of the recurrence, which is the unique ruin probability by the standard absorption argument for finite Markov chains.",
        complexityRationale:
            "The system has target minus one unknowns. Forward elimination and back substitution each visit every interior state a constant number of times, so the work is O(target) time and the coefficient arrays use O(target) space.",
        uses: [
            "Estimating extinction risk in branching and birth-death models",
            "Bankroll management and gambling risk analysis",
            "A canonical example of absorption probabilities in Markov chains",
        ],
        references: [
            "Feller, An Introduction to Probability Theory and Its Applications, Volume 1, Chapter 14",
            "Grimmett and Stirzaker, Probability and Random Processes (gambler's ruin)",
        ],
        workedExample:
            "With capital 5, target 10, and a fair coin p = 0.5, the recurrence has the linear solution r_i = (10 - i)/10. The ruin probability from capital 5 is 0.5. With p = 0.4 the curve bends upward and the ruin probability from capital 5 rises above one half.",
    },
    id: "gamblers-ruin",
    name: "Gambler's Ruin",
    category: "statistics-probability",
    complexity: { time: "O(N)", space: "O(N)" },
    defaultInput: { capital: 5, target: 10, p: 0.5 },
    visualType: "array",
    run,
    pseudocode: [
        "set the boundary values r_0 to one and r_N to zero",
        "build the tridiagonal system for the interior states",
        "forward eliminate to form modified upper and right-hand-side arrays",
        "back substitute to recover each interior ruin probability",
        "report the probability at the starting capital",
    ],
};

export default module;

/**
 * floor-sum-algorithm.ts - Euclidean Floor Sum.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Computes the sum over k = 0 to n-1 of floor((a*k + b) / m) in O(log m)
 * time. The algorithm repeatedly trades a and m, using the identity that
 * counts how many times a linear function crosses a multiple of m. It is the
 * workhorse behind floor-linear counting problems and divisor summations.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log(m)) Euclidean iterations
 *   Space: O(1) for the running parameters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid table shows n, m, a, b, the running answer, and y_max.
 *   - The parameter being swapped is highlighted at each step.
 *   - The final frame reports the exact floor sum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FloorSumInput {
    n?: number;
    m?: number;
    a?: number;
    b?: number;
}

function table(
    n: number,
    m: number,
    a: number,
    b: number,
    answer: number,
    yMax: number,
    iteration: number,
    done: boolean,
): VisualEntity[] {
    const rows: Array<{ field: string; value: number }> = [
        { field: "iteration", value: iteration },
        { field: "n", value: n },
        { field: "m", value: m },
        { field: "a", value: a },
        { field: "b", value: b },
        { field: "y_max", value: yMax },
        { field: "answer", value: answer },
    ];
    return rows.map((row, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: `${row.field}: ${row.value}`,
        value: row.value,
        state: (done ? "sorted" : i === 2 || i === 3 ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: i, col: 0, field: row.field },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FloorSumInput | null) ?? {};
    let n = typeof task.n === "number" && task.n >= 0 ? Math.trunc(task.n) : 10;
    let m = typeof task.m === "number" && task.m > 0 ? Math.trunc(task.m) : 7;
    let a = typeof task.a === "number" ? Math.trunc(task.a) : 3;
    let b = typeof task.b === "number" ? Math.trunc(task.b) : 5;
    let step = 0;

    yield {
        stepNumber: step,
        entities: table(n, m, a, b, 0, a * n + b, 0, false),
        edges: [],
        description: `Sum floor((${a}k + ${b})/${m}) for k from 0 to ${n - 1}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 7, cols: 1, n, m, a, b },
    };
    step += 1;

    let answer = 0;
    if (a < 0 || a >= m) {
        const quotient = Math.floor(a / m);
        a -= quotient * m;
        answer += (quotient * n * (n - 1)) / 2;
    }
    if (b < 0 || b >= m) {
        const quotient = Math.floor(b / m);
        b -= quotient * m;
        answer += quotient * n;
    }

    let iteration = 0;
    while (true) {
        iteration += 1;
        if (a >= m) {
            answer += (Math.floor((n - 1) * n * Math.floor(a / m)) / 2);
            a %= m;
        }
        if (b >= m) {
            answer += n * Math.floor(b / m);
            b %= m;
        }
        const yMax = a * n + b;
        yield {
            stepNumber: step,
            entities: table(n, m, a, b, answer, yMax, iteration, false),
            edges: [],
            description: `Iteration ${iteration}: y_max = ${yMax}; ${yMax < m ? "below m, ready to finish" : "swap m and a and recurse"}.`,
            codeLineNumber: yMax < m ? 5 : 4,
            layout: "grid",
            meta: { rows: 7, cols: 1, n, m, a, b, answer, yMax, iteration },
        };
        step += 1;
        if (yMax < m) {
            break;
        }
        const nextN = Math.floor(yMax / m);
        const nextB = yMax % m;
        const nextM = a;
        a = m;
        m = nextM;
        n = nextN;
        b = nextB;
    }

    yield {
        stepNumber: step,
        entities: table(n, m, a, b, answer, a * n + b, iteration, true),
        edges: [],
        description: `Done: the floor sum equals ${answer}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 7, cols: 1, answer, iterations: iteration },
    };
}

const module: AlgorithmModule = {
    id: "floor-sum-algorithm",
    name: "Euclidean Floor Sum",
    category: "math",
    complexity: { time: "O(log m)", space: "O(1)" },
    defaultInput: { n: 10, m: 7, a: 3, b: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "reduce a and b modulo m, banking their whole-part contributions",
        "loop while the largest value a*n + b reaches m",
        "if a >= m add (n-1)n/2 times its quotient and reduce a",
        "if b >= m add n times its quotient and reduce b",
        "set y_max = a*n + b; if y_max < m stop",
        "swap m and a, set n = y_max/m and b = y_max mod m",
        "return the accumulated answer",
    ],
    education: {
        intuition:
            "Counting lattice points below a slanted line can be done by counting points above it instead. The floor-sum identity swaps the slope and the modulus, shrinking the problem the same way Euclid's algorithm shrinks a pair of integers, while banking whole multiples that move directly into the answer.",
        invariants: [
            "The original sum always equals the accumulated answer plus the sum for the current reduced parameters.",
            "After reduction both a and b lie strictly between zero and m.",
            "Each swap strictly decreases the modulus m, so the loop terminates.",
        ],
        correctness:
            "Splitting a and b into whole parts and remainders is exact because floor((q m + r)k + b)/m equals q k plus floor((r k + b)/m). For reduced parameters the identity sum floor((a k + b)/m) equals n times b over m plus a count of lattice points under the line, and reflecting that count across the line gives the same sum with m and a exchanged and n replaced by y_max over m. This is the Euclidean step, so induction on m proves the accumulated answer is exact.",
        complexityRationale:
            "Each iteration replaces m by the previous a, which is smaller than m, exactly as in Euclid's algorithm; therefore the number of iterations is logarithmic in m and each uses constant work.",
        uses: [
            "Counting divisor sums and lattice points under linear bounds",
            "Competitive programming problems involving floor expressions",
            "Subroutines in algorithms for sums over arithmetic progressions",
        ],
        references: [
            "AtCoder Library, floor_sum function",
            "Knuth, The Art of Computer Programming, Volume 1, Section 1.2.4",
        ],
        workedExample:
            "For n=10, m=7, a=3, b=5 the direct terms are 0,1,1,2,2,2,3,3,4,4, which sum to 22. The algorithm records y_max=35, swaps to a smaller modulus, and returns the same 22 in a few iterations.",
    },
};

export default module;

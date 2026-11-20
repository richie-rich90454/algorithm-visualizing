/**
 * binomial-coefficient.ts - Exact Binomial Coefficient by Cancellation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This module computes the exact binomial coefficient C(n, k) as a big integer
 * using the multiplicative identity C(n, k) = product over i from 1 to k of
 * (n - k + i) / i. Taking k as the smaller of k and n-k keeps the loop short,
 * and dividing after each multiplication keeps every intermediate value equal
 * to a smaller integer binomial coefficient, so the arithmetic stays exact.
 * This is distinct from the cataloged modular factorial-table method and from
 * Lucas' theorem, both of which compute residues modulo a prime rather than
 * the full integer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(min(k, n-k)) big-integer operations
 *   Space: O(1) beyond the result
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build bar entities from the displayed running values. */
function makeBars(values: number[], highlight: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index === highlight ? "active" : index === values.length - 1 ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

/**
 * Compute C(n,k) exactly by multiplying then dividing at each step.
 * Returns the full sequence of intermediate coefficients for the frames.
 */
function coefficient(n: number, k: number): { value: bigint; intermediates: bigint[] } {
    const small = Math.min(k, n - k);
    let result = 1n;
    const intermediates: bigint[] = [1n];
    for (let i = 1; i <= small; i += 1) {
        result = (result * BigInt(n - small + i)) / BigInt(i);
        intermediates.push(result);
    }
    return { value: result, intermediates };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; k?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.trunc(task.n) : 20;
    const k = typeof task.k === "number" ? Math.trunc(task.k) : 6;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([n, k], 0),
        edges: [],
        description: `Computing the exact binomial coefficient C(${n}, ${k}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, k, phase: "start" },
    };
    step += 1;

    if (!(n >= 0) || !(k >= 0) || k > n) {
        yield {
            stepNumber: step,
            entities: makeBars([], -1),
            edges: [],
            description: "The parameters must satisfy zero less than or equal to k less than or equal to n.",
            codeLineNumber: 0,
            layout: "array",
            meta: { n, k, error: true },
        };
        return;
    }

    const { value, intermediates } = coefficient(n, k);
    const shown = intermediates.map((v) => Number(v % 1000000n));
    yield {
        stepNumber: step,
        entities: makeBars(shown, -1),
        edges: [],
        description: `Using symmetry, only ${Math.min(k, n - k)} multiplicative step(s) are needed.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { n, k, steps: Math.min(k, n - k), values: shown.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(shown, shown.length - 1),
        edges: [],
        description: `All cancelations complete: C(${n}, ${k}) = ${value.toString()}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, k, value: value.toString(), complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The binomial coefficient counts ways to choose k objects from n. Instead of computing three enormous factorials, build the answer one factor at a time: multiply by the next numerator term and immediately divide by the loop index. Symmetry lets you replace k by n minus k when that is smaller, which often cuts the work substantially.",
        invariants: [
            "After the i-th step the running value equals C(n-k+i, i), an exact integer.",
            "Dividing after each multiplication keeps the intermediate size close to the final answer.",
            "Using the smaller of k and n-k does not change the result because C(n,k) equals C(n,n-k).",
        ],
        correctness:
            "The identity C(m, i) equals C(m-1, i-1) times m over i follows directly from the factorial definition. Starting from C(n-k, 0) equals one and applying it for i from one to k gives C(n, k) after exactly k steps. Since every intermediate C(n-k+i, i) is an integer, each division is exact, so integer arithmetic with no rounding computes the exact coefficient.",
        complexityRationale:
            "The loop runs min(k, n-k) times, and each iteration performs one big-integer multiplication and one exact division, so the time is linear in that count. Besides the output, only a few scalar big integers are kept, giving constant auxiliary space.",
        uses: [
            "Counting combinations in combinatorics and probability calculations",
            "Computing exact coefficients in binomial expansions and generating functions",
            "Verifying results of modular binomial methods with an exact reference value",
        ],
        references: [
            "Knuth, The Art of Computer Programming Volume 1, Section 1.2.6",
            "Graham, Knuth, and Patashnik, Concrete Mathematics, Chapter 5",
        ],
        workedExample:
            "For n = 20 and k = 6 the smaller parameter is 6. Starting from one, multiply by 15 and divide by 1 to get 15, then multiply by 16 and divide by 2 to get 120, and continue. After six steps the exact result is 38760.",
    },
    id: "binomial-coefficient",
    name: "Binomial Coefficient (Exact)",
    category: "math",
    complexity: { time: "O(min(k, n-k))", space: "O(1)" },
    defaultInput: { n: 20, k: 6 },
    visualType: "array",
    run,
    pseudocode: [
        "let small be the smaller of k and n minus k",
        "set the running value to one",
        "for i from one up to small",
        "multiply the running value by n minus small plus i",
        "divide the result exactly by i",
        "record the new integer binomial coefficient",
        "report the final value as C(n, k)",
    ],
};

export default module;

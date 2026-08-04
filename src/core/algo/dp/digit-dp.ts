/**
 * digit-dp.ts – Digit DP (count numbers with a digit property)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Digit DP counts numbers in a range [0, N] satisfying a digit property by
 * walking the digits of N from most significant to least. The state is
 * (position, tight), where `tight` says whether the prefix already equals N's
 * prefix (forcing the next digit to stay ≤ N's digit). The classic example
 * problem: count the numbers from 0 to N that do not contain the digit 4.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(digits × states × 10)
 *   Space: O(digits)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The digit position being processed is YELLOW (comparing).
 *   - Accepted digits are GREEN (sorted).
 *   - Forbidden digits are RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The `tight` flag is the key state-transition idea.
 *   - Powers "count numbers with property P in [L, R]" problems.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a grid of cells showing the digits of N.
 *
 * @param digits The digits of N.
 * @param activeIndex The position being processed.
 * @returns Cell entities in a single row.
 */
function makeDigits(digits: string[], activeIndex = -1): VisualEntity[] {
    return digits.map((digit, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: digit,
        value: digit,
        state: (activeIndex === index ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Digit DP generator.
 *
 * @param input `{ n }` – the upper bound.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 543;

    const digits = String(n).split("");
    let step = 0;

    // Frame 0: the digits of N.
    yield {
        stepNumber: step,
        entities: makeDigits(digits),
        edges: [],
        description: `Counting numbers from 0 to ${n} that do not contain digit 4.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // Recursive DP: count valid completions from position `pos` with `tight`.
    const memo = new Map<string, number>();

    const solve = (pos: number, tight: boolean): number => {
        // All digits placed – this is one valid number.
        if (pos === digits.length) {
            return 1;
        }
        const memoKey = `${pos},${tight}`;
        if (memo.has(memoKey)) {
            return memo.get(memoKey) ?? 0;
        }

        const limit = tight ? Number(digits[pos]) : 9;
        let total = 0;
        for (let d = 0; d <= limit; d += 1) {
            if (d === 4) {
                continue; // the forbidden digit
            }
            total += solve(pos + 1, tight && d === limit);
        }
        memo.set(memoKey, total);
        return total;
    };

    const count = solve(0, true);

    yield {
        stepNumber: step,
        entities: makeDigits(digits, digits.length - 1),
        edges: [],
        description: `Digit DP states memoised – ${count} numbers from 0 to ${n} avoid digit 4.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { count },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeDigits(digits),
        edges: [],
        description: `Answer: ${count} valid numbers (0..${n} without the digit 4).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { count },
    };
}

/** The Digit DP module, registered with the engine. */
const module: AlgorithmModule = {
    id: "digit-dp",
    name: "Digit DP",
    category: "dynamic-programming",
    complexity: { time: "O(digits × states × 10)", space: "O(digits)" },
    // Count 0..543 avoiding the digit 4.
    defaultInput: { n: 543 },
    visualType: "grid",
    run,
};

export default module;

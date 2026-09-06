/**
 * probability-dp.ts – Probability DP (expected value)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Probability DPs compute expected values or probabilities with a recurrence.
 * The classic example: the expected number of coin flips to get k consecutive
 * heads, with a fair coin. Let E[k] be the expected remaining flips when we
 * already have k consecutive heads:
 *
 *   E[k] = 1 + ½·E[k+1] + ½·E[0]   (tails resets)
 *
 * This visualization computes the expected flips via a DP over "heads streak".
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k)
 *   Space: O(k)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The streak state being updated is YELLOW (comparing).
 *   - Its contributors are PINK (highlight).
 *   - The final expectation is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Expected-value recurrences mix states with probabilities.
 *   - The reset-on-failure structure is very common.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cell entities for the expectations.
 *
 * @param values The expected-value DP array.
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single row.
 */
function makeCells(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: value.toFixed(2),
        value,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Probability DP generator.
 *
 * @param input `{ target }` – consecutive heads needed.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { target?: number } | null) ?? {};
    // Only integers size the E array (a float would throw in `new Array`,
    // NaN/Infinity would poison it); negatives keep their dedicated branch.
    const raw = typeof task.target === "number" ? task.target : 3;
    const target = Number.isInteger(raw) ? raw : 3;

    let step = 0;

    // Edge case: a negative target is meaningless.
    if (target < 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Negative target – no streak to wait for.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { target },
        };
        return;
    }

    // E[k] = 1 + ½·E[k+1] + ½·E[0] is circular in E[0]: substituting the
    // not-yet-computed E[0] with 0 would silently under-count. E[0] satisfies
    // E[0] = 2 + E[1], which unfolds to the closed form 2^(target+1) − 2, so
    // seed it up front and every displayed equation below is exact.
    const answer = 2 ** (target + 1) - 2;

    // E[streak] = expected flips remaining given `streak` consecutive heads.
    const E = new Array<number>(target + 1).fill(0);
    E[target] = 0; // already done
    E[0] = answer;

    // Frame 0: the initialized array (E[target] = 0).
    yield {
        stepNumber: step,
        entities: makeCells(E),
        edges: [],
        description: `Expected coin flips to get ${target} consecutive heads.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { target },
    };
    step += 1;

    // Solve backwards from target-1 down to 0.
    // E[k] = 1 + ½·E[k+1] + ½·E[0] for k < target.
    for (let k = target - 1; k >= 0; k -= 1) {
        const nextStreak = E[k + 1] ?? 0;
        const reset = E[0] ?? 0;
        E[k] = 1 + 0.5 * nextStreak + 0.5 * reset;

        const states = new Map<number, EntityState>([
            [k, "comparing"],
            [k + 1, "highlight"],
        ]);
        if (k === 0) {
            states.set(0, "highlight");
        }
        yield {
            stepNumber: step,
            entities: makeCells(E, states),
            edges: [],
            description: `E[${k}] = 1 + ½·E[${k + 1}] + ½·E[0] = ${E[k].toFixed(2)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { target },
        };
        step += 1;
    }

    const finalStates = new Map<number, EntityState>([[0, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeCells(E, finalStates),
        edges: [],
        description: `Expected flips = ${E[0].toFixed(2)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { target, expected: E[0] },
    };
}

/** The Probability DP module, registered with the engine. */
const module: AlgorithmModule = {
    id: "probability-dp",
    name: "Probability DP",
    category: "dynamic-programming",
    complexity: { time: "O(k)", space: "O(k)" },
    // 3 consecutive heads needs 14 expected flips.
    defaultInput: { target: 3 },
    visualType: "grid",
    run,
};

export default module;

/**
 * wythoff.ts – Wythoff's Game
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Wythoff's game is a two-pile Nim variant: a move removes any positive number
 * of stones from one pile, OR the same number from both piles. The losing
 * positions are exactly the pairs (⌊n·φ⌋, ⌊n·φ²⌋) for n ≥ 0, where
 * φ = (1 + √5)/2 is the golden ratio. These are called "cold" positions and
 * form the Wythoff pairs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per position check via the golden-ratio formula
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The two piles are shown as bars.
 *   - A cold (losing) position is RED (swapped).
 *   - A winning position is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The golden ratio appearing in a game is the delight of the theory.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a pair of bars for the two piles.
 *
 * @param a Pile A size.
 * @param b Pile B size.
 * @param state The state colour for both bars.
 * @returns Two bar entities.
 */
function makeBars(a: number, b: number, state: EntityState): VisualEntity[] {
    return [a, b].map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/**
 * The Wythoff generator.
 *
 * @param input `{ a, b }` – the two pile sizes.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 8;
    const b = typeof task.b === "number" ? task.b : 13;

    let step = 0;

    // Frame 0: the two piles.
    yield {
        stepNumber: step,
        entities: makeBars(a, b, "idle"),
        edges: [],
        description: `Wythoff's game with piles (${a}, ${b}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;

    // The golden ratio.
    const phi = (1 + Math.sqrt(5)) / 2;

    // A position is cold iff (min, max) = (⌊n·φ⌋, ⌊n·φ²⌋) for some n.
    const min = Math.min(a, b);
    const max = Math.max(a, b);

    // Solve n from the smaller coordinate: n ≈ min / φ.
    const n = Math.round(min / phi);
    const coldMin = Math.floor(n * phi);
    const coldMax = Math.floor(n * phi * phi);

    // Also check n-1, n, n+1 for safety.
    const isCold =
        (coldMin === min && coldMax === max) ||
        (Math.floor((n - 1) * phi) === min && Math.floor((n - 1) * phi * phi) === max) ||
        (Math.floor((n + 1) * phi) === min && Math.floor((n + 1) * phi * phi) === max);

    yield {
        stepNumber: step,
        entities: makeBars(a, b, isCold ? "swapped" : "sorted"),
        edges: [],
        description: isCold
            ? `(${min}, ${max}) is a cold (losing) position – a Wythoff pair.`
            : `(${min}, ${max}) is a winning position.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { cold: isCold, phi: phi.toFixed(6) },
    };
}

/** The Wythoff module, registered with the engine. */
const module: AlgorithmModule = {
    id: "wythoff",
    name: "Wythoff's Game",
    category: "game",
    complexity: { time: "O(1)", space: "O(1)" },
    // (8, 13) is a classic Wythoff pair.
    defaultInput: { a: 8, b: 13 },
    visualType: "array",
    run,
};

export default module;

/**
 * sprague-grundy.ts – Sprague-Grundy Theorem (Grundy numbers)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Sprague-Grundy theorem generalises Nim to all impartial games. Every
 * game position gets a Grundy number g: the mex (minimum excluded) of the
 * Grundy numbers of all reachable positions. A position is a win iff g ≠ 0.
 * The Grundy number of a disjoint sum of games is the XOR of their individual
 * Grundy numbers.
 *
 * This visualisation computes Grundy numbers for the classic "subtraction
 * game" (remove 1, 2, or 3 tokens; last token wins) up to n tokens.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n · moves)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - Each token count is a cell showing its Grundy number.
 *   - Cells with Grundy 0 (losing) are RED (swapped).
 *   - Winning counts are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - mex + XOR = the entire theory of impartial games.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cells showing Grundy numbers for each token count.
 *
 * @param grundy The Grundy number per count.
 * @param active The count being computed (or -1).
 * @returns Cell entities in a single row.
 */
function makeCells(grundy: number[], active = -1): VisualEntity[] {
    return grundy.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state:
            index === active ? "comparing" : ((value === 0 ? "swapped" : "sorted") as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Sprague-Grundy generator.
 *
 * @param input `{ maxTokens }` – compute Grundy numbers up to this count.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { maxTokens?: number } | null) ?? {};
    const maxTokens = typeof task.maxTokens === "number" ? task.maxTokens : 20;
    const moves = [1, 2, 3]; // remove 1, 2, or 3 tokens

    let step = 0;
    const grundy = new Array<number>(maxTokens + 1).fill(0);

    // Frame 0: all zero.
    yield {
        stepNumber: step,
        entities: makeCells(grundy),
        edges: [],
        description: `Sprague-Grundy numbers for a subtraction game (remove 1–3 tokens) up to ${maxTokens}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;

    // Compute Grundy numbers bottom-up.
    for (let tokens = 1; tokens <= maxTokens; tokens += 1) {
        const reachable = new Set<number>();
        for (const move of moves) {
            if (tokens - move >= 0) {
                reachable.add(grundy[tokens - move] ?? 0);
            }
        }

        // mex: the smallest non-negative integer not in the reachable set.
        let mex = 0;
        while (reachable.has(mex)) {
            mex += 1;
        }
        grundy[tokens] = mex;

        yield {
            stepNumber: step,
            entities: makeCells(grundy, tokens),
            edges: [],
            description: `G(${tokens}) = mex of {${[...reachable].join(", ")}} = ${mex}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {},
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(grundy),
        edges: [],
        description: `Grundy numbers computed – positions with value 0 are losing.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {},
    };
}

/** The Sprague-Grundy module, registered with the engine. */
const module: AlgorithmModule = {
    id: "sprague-grundy",
    name: "Sprague-Grundy",
    category: "game",
    complexity: { time: "O(n·moves)", space: "O(n)" },
    // The subtraction game up to 20 tokens.
    defaultInput: { maxTokens: 20 },
    visualType: "grid",
    run,
};

export default module;

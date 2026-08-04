/**
 * misere-nim.ts – Misère Nim Game
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Misère Nim is the same as Nim except the player who takes the *last* stone
 * LOSES. The winning condition flips in an interesting way:
 *
 *   - If every pile has size ≤ 1, the position is a loss iff the number of
 *     1-stone piles is even (the player to move must take the last stone).
 *   - Otherwise, the normal-play rule applies: winning iff nim-sum ≠ 0.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each pile is shown as a column of stones.
 *   - Losing positions are RED (swapped); winning positions GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "all piles ≤ 1" special case is the entire twist.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a pile visualization: each pile is a column of cells.
 *
 * @param piles The pile sizes.
 * @returns Cell entities in a grid (rows = max pile, cols = piles).
 */
function makeGrid(piles: number[]): VisualEntity[] {
    const maxHeight = Math.max(...piles, 1);
    const cells: VisualEntity[] = [];
    for (let pile = 0; pile < piles.length; pile += 1) {
        for (let row = 0; row < maxHeight; row += 1) {
            const hasStone = row < (piles[pile] ?? 0);
            cells.push({
                id: `cell-${pile}-${row}`,
                type: "cell" as const,
                label: hasStone ? "●" : "",
                value: hasStone ? 1 : 0,
                state: hasStone ? ("sorted" as EntityState) : "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: maxHeight - 1 - row, col: pile },
            });
        }
    }
    return cells;
}

/**
 * The Misère Nim generator.
 *
 * @param input `{ piles }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { piles?: number[] } | null) ?? {};
    const piles = task.piles ?? [1, 2, 3];

    let step = 0;
    const nimSum = piles.reduce((a, b) => a ^ b, 0);
    const allOnes = piles.every((p) => p <= 1);
    const onesCount = piles.filter((p) => p === 1).length;

    // Misère rule.
    let winning: boolean;
    if (allOnes) {
        winning = onesCount % 2 === 1; // odd ones → you win (you leave 0 piles)
    } else {
        winning = nimSum !== 0;
    }

    // Frame 0: the piles.
    yield {
        stepNumber: step,
        entities: makeGrid(piles),
        edges: [],
        description: `Misère Nim [${piles.join(", ")}] (last stone LOSES).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { nimSum },
    };
    step += 1;

    // Color the position.
    const resultGrid = makeGrid(piles);
    for (const cell of resultGrid) {
        if (cell.value === 1) {
            cell.state = winning ? "sorted" : "swapped";
        }
    }

    yield {
        stepNumber: step,
        entities: resultGrid,
        edges: [],
        description: winning
            ? "Winning position for the player to move."
            : "Losing position for the player to move.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { nimSum, winning },
    };
}

/** The Misère Nim module, registered with the engine. */
const module: AlgorithmModule = {
    id: "misere-nim",
    name: "Misère Nim",
    category: "game",
    complexity: { time: "O(p)", space: "O(1)" },
    // [1, 2, 3] has nim-sum 0 but is winning in misère play (not all ones).
    defaultInput: { piles: [1, 2, 3] },
    visualType: "grid",
    run,
};

export default module;

/**
 * nim.ts – Nim Game
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Nim is the archetypal impartial combinatorial game. There are several piles
 * of stones; a move removes any positive number of stones from a single pile.
 * The player who takes the last stone wins (normal play). The theory is
 * beautiful: a position is a win for the player to move iff the XOR of all
 * pile sizes (the "nim-sum") is non-zero.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(p) to evaluate a position (XOR over p piles)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each pile is shown as a stack of stones (bars/cells).
 *   - The winning move is highlighted (removing stones to zero the nim-sum).
 *   - Winning positions are GREEN (sorted); losing positions RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Sprague-Grundy generalizes this XOR to all impartial games.
 *   - The winning move sets some pile to (pile XOR nim-sum).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a pile visualization: each pile is a column of cells.
 *
 * @param piles The pile sizes.
 * @param highlight The pile to highlight (or -1).
 * @returns Cell entities in a grid (rows = max pile, cols = piles).
 */
function makeGrid(piles: number[], highlight = -1): VisualEntity[] {
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
                state: hasStone
                    ? pile === highlight
                        ? ("comparing" as EntityState)
                        : ("sorted" as EntityState)
                    : "unvisited",
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
 * The Nim generator.
 *
 * @param input `{ piles }` – the pile sizes.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { piles?: number[] } | null) ?? {};
    const piles = task.piles ?? [3, 4, 5];

    let step = 0;
    const nimSum = piles.reduce((a, b) => a ^ b, 0);

    // Frame 0: the piles.
    yield {
        stepNumber: step,
        entities: makeGrid(piles),
        edges: [],
        description: `Nim position [${piles.join(", ")}] – nim-sum = ${nimSum}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { nimSum },
    };
    step += 1;

    // The position is winning iff nim-sum ≠ 0.
    const winning = nimSum !== 0;

    if (winning) {
        // Find a winning move: a pile p where (p XOR nimSum) < p.
        let chosen = -1;
        let newSize = 0;
        for (let i = 0; i < piles.length; i += 1) {
            const p = piles[i] ?? 0;
            const target = p ^ nimSum;
            if (target < p) {
                chosen = i;
                newSize = target;
                break;
            }
        }

        yield {
            stepNumber: step,
            entities: makeGrid(piles, chosen),
            edges: [],
            description:
                chosen >= 0
                    ? `Winning move: reduce pile ${chosen} from ${piles[chosen]} to ${newSize} (making the nim-sum 0).`
                    : "Winning position.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { nimSum, winning: true, chosen, newSize },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeGrid(piles),
            edges: [],
            description: "Losing position – every move hands the opponent a winning position.",
            codeLineNumber: 3,
            layout: "grid",
            meta: { nimSum, winning: false },
        };
    }
}

/** The Nim module, registered with the engine. */
const module: AlgorithmModule = {
    id: "nim",
    name: "Nim Game",
    category: "game",
    complexity: { time: "O(p)", space: "O(1)" },
    // [3, 4, 5] has nim-sum 2 → a winning position.
    defaultInput: { piles: [3, 4, 5] },
    visualType: "grid",
    run,
};

export default module;

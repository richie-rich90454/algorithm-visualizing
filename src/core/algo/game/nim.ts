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
 *   - One frame per pile shows its binary contribution (`pile ^ running-xor`).
 *   - The winning move is highlighted (removing stones to zero the nim-sum),
 *     then executed so the zeroed position is shown.
 *   - From a losing position one sample reply shows the non-zero nim-sum handed back.
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
    const piles = Array.isArray(task.piles) ? task.piles : [3, 4, 5];

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

    // One frame per pile: its binary contribution to the running xor.
    const bitLen = (x: number): number => Math.max(1, Math.floor(Math.abs(x)).toString(2).length);
    const width = Math.max(bitLen(nimSum), ...piles.map((p) => bitLen(p)));
    const bin = (x: number): string => {
        const v = Math.floor(x);
        const s = Math.abs(v).toString(2).padStart(width, "0");
        return v < 0 ? `-${s}` : s;
    };
    let running = 0;
    for (let i = 0; i < piles.length; i += 1) {
        const p = piles[i] ?? 0;
        const next = running ^ p;
        yield {
            stepNumber: step,
            entities: makeGrid(piles, i),
            edges: [],
            description: `Pile ${i} = ${p} (${bin(p)}) ^ running ${running} (${bin(running)}) = ${next} (${bin(next)}).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { nimSum, pile: i, pileSize: p, runningBefore: running, runningAfter: next },
        };
        step += 1;
        running = next;
    }

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
        step += 1;

        // Execute the move: show the reduced piles with nim-sum 0.
        if (chosen >= 0) {
            const after = [...piles];
            after[chosen] = newSize;
            const afterSum = after.reduce((a, b) => a ^ b, 0);
            yield {
                stepNumber: step,
                entities: makeGrid(after),
                edges: [],
                description: `After the move [${after.join(", ")}] – nim-sum = ${afterSum}, a P-position (losing for the next player).`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { nimSum: afterSum, winning: true, chosen, newSize },
            };
        }
    } else {
        yield {
            stepNumber: step,
            entities: makeGrid(piles),
            edges: [],
            description: "Losing position – every move hands the opponent a winning position.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { nimSum, winning: false },
        };
        step += 1;

        // One sample reply: take a single stone and show the non-zero nim-sum handed back.
        const mover = piles.findIndex((p) => p > 0);
        if (mover < 0) {
            yield {
                stepNumber: step,
                entities: makeGrid(piles),
                edges: [],
                description: `No legal move – [${piles.join(", ")}] is terminal with nim-sum 0.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { nimSum, winning: false },
            };
        } else {
            const after = [...piles];
            after[mover] = (after[mover] ?? 0) - 1;
            const afterSum = after.reduce((a, b) => a ^ b, 0);
            yield {
                stepNumber: step,
                entities: makeGrid(after, mover),
                edges: [],
                description: `Sample reply: reduce pile ${mover} from ${piles[mover]} to ${after[mover]} → [${after.join(", ")}] with nim-sum ${afterSum} ≠ 0, winning for the next player.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { nimSum: afterSum, winning: false },
            };
        }
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

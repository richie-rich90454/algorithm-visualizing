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
 *   - One frame per pile shows its contribution (binary `pile ^ running-xor`
 *     when a pile > 1 exists, singleton count otherwise).
 *   - The all-singletons branch shows the parity count before the verdict.
 *   - The winning move is executed; a losing position shows one sample reply.
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
 * The Misère Nim generator.
 *
 * @param input `{ piles }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { piles?: number[] } | null) ?? {};
    const piles = Array.isArray(task.piles) ? task.piles : [1, 2, 3];

    let step = 0;
    const nimSum = piles.reduce((a, b) => a ^ b, 0);
    const allOnes = piles.every((p) => p <= 1);
    const onesCount = piles.filter((p) => p === 1).length;

    // Misère rule: with only singletons left, taking the last stone loses,
    // so an even number of 1-piles wins (you hand the opponent the last stone).
    let winning: boolean;
    if (allOnes) {
        winning = onesCount % 2 === 0;
    } else {
        winning = nimSum !== 0;
    }

    // Same rule, applied to a hypothetical position (for honest move captions).
    const isP = (pos: number[]): boolean => {
        if (pos.every((p) => p <= 1)) return pos.filter((p) => p === 1).length % 2 === 1;
        return pos.reduce((a, b) => a ^ b, 0) === 0;
    };

    // Frame 0: the piles.
    yield {
        stepNumber: step,
        entities: makeGrid(piles),
        edges: [],
        description: `Misère Nim [${piles.join(", ")}] (last stone LOSES) – nim-sum = ${nimSum}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { nimSum },
    };
    step += 1;

    // Color helper: green for the player to move when winning, red when losing.
    const paintVerdict = (grid: VisualEntity[], won: boolean): VisualEntity[] => {
        for (const cell of grid) {
            if (cell.value === 1) cell.state = won ? "sorted" : "swapped";
        }
        return grid;
    };

    if (allOnes) {
        // Per-pile singleton count.
        let seen = 0;
        for (let i = 0; i < piles.length; i += 1) {
            const p = piles[i] ?? 0;
            const next = seen + (p === 1 ? 1 : 0);
            yield {
                stepNumber: step,
                entities: makeGrid(piles, i),
                edges: [],
                description: `Pile ${i} = ${p}${p === 1 ? " (singleton)" : " (empty)"} – singletons so far ${seen} → ${next}.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { nimSum, pile: i, singletonsBefore: seen, singletonsAfter: next },
            };
            step += 1;
            seen = next;
        }

        // Parity count frame before the verdict.
        const parity = onesCount % 2 === 0 ? "even" : "odd";
        yield {
            stepNumber: step,
            entities: makeGrid(piles),
            edges: [],
            description: `All piles ≤ 1: ${onesCount} singleton(s) – ${onesCount} is ${parity} → ${winning ? "winning (take one and hand the opponent the last stone)" : "losing (every move hands the opponent an even count)"}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { nimSum, ones: onesCount, winning },
        };
        step += 1;

        // The verdict.
        yield {
            stepNumber: step,
            entities: paintVerdict(makeGrid(piles), winning),
            edges: [],
            description: winning
                ? "Winning position for the player to move."
                : "Losing position for the player to move.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { nimSum, winning },
        };
        step += 1;

        // Take one whole singleton (or admit there is no move).
        const taker = piles.findIndex((p) => p === 1);
        if (taker < 0) {
            yield {
                stepNumber: step,
                entities: makeGrid(piles),
                edges: [],
                description: `No legal move – [${piles.join(", ")}] is terminal.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { nimSum, winning },
            };
        } else if (winning) {
            yield {
                stepNumber: step,
                entities: makeGrid(piles, taker),
                edges: [],
                description: `Winning move: take singleton pile ${taker}, leaving ${onesCount - 1} singleton(s) (odd) for the opponent.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { nimSum, winning, chosen: taker },
            };
            step += 1;
            const after = [...piles];
            after[taker] = 0;
            yield {
                stepNumber: step,
                entities: paintVerdict(makeGrid(after), false),
                edges: [],
                description: `After the move [${after.join(", ")}] – ${onesCount - 1} singleton(s) (odd), losing for the next player.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { nimSum: after.reduce((a, b) => a ^ b, 0), winning },
            };
        } else {
            const after = [...piles];
            after[taker] = 0;
            yield {
                stepNumber: step,
                entities: makeGrid(after),
                edges: [],
                description: `Sample reply: take singleton pile ${taker} → [${after.join(", ")}] with ${onesCount - 1} singleton(s) (even), winning for the next player.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { nimSum: after.reduce((a, b) => a ^ b, 0), winning },
            };
        }
        return;
    }

    // A pile > 1 exists: mirror normal Nim, with the misère caveat.
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

    if (winning) {
        // Normal-play candidate: a pile p where (p XOR nimSum) < p.
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

        const naive = [...piles];
        if (chosen >= 0) naive[chosen] = newSize;
        if (chosen >= 0 && isP(naive)) {
            yield {
                stepNumber: step,
                entities: makeGrid(piles, chosen),
                edges: [],
                description: `Winning move: reduce pile ${chosen} from ${piles[chosen]} to ${newSize}. A pile > 1 is present, so the normal nim-sum rule applies.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { nimSum, winning: true, chosen, newSize },
            };
            step += 1;
            const afterSum = naive.reduce((a, b) => a ^ b, 0);
            yield {
                stepNumber: step,
                entities: paintVerdict(makeGrid(naive), false),
                edges: [],
                description: `After the move [${naive.join(", ")}] – nim-sum = ${afterSum}, a P-position (losing for the next player).`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { nimSum: afterSum, winning: true, chosen, newSize },
            };
        } else if (chosen >= 0) {
            // Misère endgame caveat: zeroing the nim-sum would leave only
            // singletons with an even count (winning for the next player),
            // so instead leave an odd number of singletons.
            const others = piles.filter((p, i) => i !== chosen && p === 1).length;
            const fixed = others % 2 === 0 ? 1 : 0;
            const after = [...piles];
            after[chosen] = fixed;
            yield {
                stepNumber: step,
                entities: makeGrid(piles, chosen),
                edges: [],
                description: `Normal play would reduce pile ${chosen} to ${newSize}, leaving [${naive.join(", ")}] (even singletons, winning for the next player) – instead take pile ${chosen} from ${piles[chosen]} to ${fixed}, leaving [${after.join(", ")}] with ${others + fixed} singleton(s) (odd).`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { nimSum, winning: true, chosen, newSize: fixed },
            };
            step += 1;
            yield {
                stepNumber: step,
                entities: paintVerdict(makeGrid(after), false),
                edges: [],
                description: `After the move [${after.join(", ")}] – ${others + fixed} singleton(s) (odd), losing for the next player.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { nimSum: after.reduce((a, b) => a ^ b, 0), winning: true, chosen },
            };
        } else {
            yield {
                stepNumber: step,
                entities: paintVerdict(makeGrid(piles), true),
                edges: [],
                description: "Winning position for the player to move.",
                codeLineNumber: 2,
                layout: "grid",
                meta: { nimSum, winning },
            };
        }
    } else {
        yield {
            stepNumber: step,
            entities: paintVerdict(makeGrid(piles), false),
            edges: [],
            description:
                "Losing position – a pile > 1 is present so the normal nim-sum rule applies: every move makes the nim-sum non-zero.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { nimSum, winning },
        };
        step += 1;

        // One sample reply: take a single stone; the result is N by the P-rule above.
        const mover = piles.findIndex((p) => p > 0);
        if (mover < 0) {
            yield {
                stepNumber: step,
                entities: makeGrid(piles),
                edges: [],
                description: `No legal move – [${piles.join(", ")}] is terminal.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { nimSum, winning },
            };
        } else {
            const after = [...piles];
            after[mover] = (after[mover] ?? 0) - 1;
            const afterSum = after.reduce((a, b) => a ^ b, 0);
            const afterAllOnes = after.every((p) => p <= 1);
            const afterOnes = after.filter((p) => p === 1).length;
            yield {
                stepNumber: step,
                entities: makeGrid(after, mover),
                edges: [],
                description: `Sample reply: reduce pile ${mover} from ${piles[mover]} to ${after[mover]} → [${after.join(", ")}] with nim-sum ${afterSum}, winning for the next player${afterAllOnes ? ` (${afterOnes} singleton(s), even)` : " (a pile > 1 remains, so the normal rule applies)"}.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { nimSum: afterSum, winning },
            };
        }
    }
}

/** The Misère Nim module, registered with the engine. */
const module: AlgorithmModule = {
    id: "misere-nim",
    name: "Misère Nim",
    category: "game",
    complexity: { time: "O(p)", space: "O(1)" },
    // [1, 2, 3] has nim-sum 0 and a pile > 1, so it is losing (P-position) in misère play too.
    defaultInput: { piles: [1, 2, 3] },
    visualType: "grid",
    run,
};

export default module;

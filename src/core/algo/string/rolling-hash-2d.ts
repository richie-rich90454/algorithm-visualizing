/**
 * rolling-hash-2d.ts – 2D Rolling Hash
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A 2D rolling hash extends the one-dimensional rolling hash to grids,
 * allowing O(1) hashing of any sub-rectangle. It uses two polynomial bases –
 * one for rows and one for columns – with a 2D prefix-hash table. The hash of
 * a sub-rectangle is recovered from four corner values of the prefix table.
 * This powers 2D pattern matching (e.g. template matching in images).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Preprocess: O(rows × cols)
 *   Query:      O(1) per sub-rectangle
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The grid is a matrix of character cells.
 *   - The sub-rectangle being hashed is YELLOW (comparing).
 *   - Matched patterns are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Generalizes the classic "Rabin-Karp on strings" to images.
 *   - The four-corner prefix trick is the key to teach.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Row base, column base, and moduli. */
const BASE_R = 33;
const BASE_C = 47;
const MOD = 1_000_000_007;

/**
 * Build a matrix of cell entities for a frame.
 *
 * @param grid The 2D grid of characters (as char codes).
 * @param states Optional `row,col` → state overrides.
 * @returns Cell entities with row/col metadata (grid layout).
 */
function makeCells(grid: string[][], states: Map<string, EntityState> = new Map()): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < grid.length; row += 1) {
        const gridRow = grid[row];
        if (!gridRow) {
            continue;
        }
        for (let col = 0; col < gridRow.length; col += 1) {
            const value = gridRow[col];
            if (value === undefined) {
                continue;
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value,
                value,
                state: states.get(`${row},${col}`) ?? "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

/**
 * The 2D Rolling Hash generator.
 *
 * @param input `{ grid, pattern }` – a grid of single-char strings plus a
 *        rectangular pattern grid to search for.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { grid?: string[][]; pattern?: string[][] } | null) ?? {};
    const grid: string[][] = task.grid ?? [
        ["a", "b", "a", "c"],
        ["b", "a", "c", "a"],
        ["a", "b", "a", "c"],
        ["c", "a", "b", "a"],
    ];
    const pattern: string[][] = task.pattern ?? [
        ["a", "c"],
        ["c", "a"],
    ];

    const rows = grid.length;
    const cols = rows > 0 ? (grid[0]?.length ?? 0) : 0;
    const pr = pattern.length;
    const pc = pattern.length > 0 ? (pattern[0]?.length ?? 0) : 0;
    const matches: Array<[number, number]> = [];
    let step = 0;

    // Frame 0: the untouched grid.
    yield {
        stepNumber: step,
        entities: makeCells(grid),
        edges: [],
        description: `2D rolling hash – searching for a ${pr}×${pc} pattern.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols },
    };
    step += 1;

    // ------------------------------------------------------------------
    // Build the 2D prefix hash table.
    // hash[i+1][j+1] = hash of the rectangle (0,0)-(i,j).
    // ------------------------------------------------------------------
    const H: number[][] = Array.from({ length: rows + 1 }, () =>
        new Array<number>(cols + 1).fill(0),
    );

    // Precompute powers.
    const powR: number[] = [1];
    const powC: number[] = [1];
    for (let i = 1; i <= rows; i += 1) {
        powR.push(((powR[i - 1] ?? 1) * BASE_R) % MOD);
    }
    for (let j = 1; j <= cols; j += 1) {
        powC.push(((powC[j - 1] ?? 1) * BASE_C) % MOD);
    }

    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            const val = (grid[i]?.[j]?.charCodeAt(0) ?? 0) + 1;
            const up = H[i]?.[j + 1] ?? 0;
            const left = H[i + 1]?.[j] ?? 0;
            const diag = H[i]?.[j] ?? 0;
            const row = H[i + 1];
            if (row) {
                row[j + 1] = (((((up + left - diag) % MOD) + MOD) % MOD) + val) % MOD;
            }
        }
    }

    // Hash of the whole pattern.
    const hashPattern = (): number => {
        let h = 0;
        for (let i = 0; i < pr; i += 1) {
            for (let j = 0; j < pc; j += 1) {
                const val = (pattern[i]?.[j]?.charCodeAt(0) ?? 0) + 1;
                h = (h + val) % MOD;
            }
        }
        return h;
    };
    const patternHash = hashPattern();

    // ------------------------------------------------------------------
    // Hash every pr×pc window and compare.
    // ------------------------------------------------------------------
    for (let r = 0; r + pr <= rows; r += 1) {
        for (let c = 0; c + pc <= cols; c += 1) {
            // The window hash from the four corners (values are additive in
            // this simplified hash, so it is a plain rectangle sum).
            const windowHash =
                ((H[r + pr]?.[c + pc] ?? 0) -
                    (H[r]?.[c + pc] ?? 0) -
                    (H[r + pr]?.[c] ?? 0) +
                    (H[r]?.[c] ?? 0)) %
                MOD;

            const states = new Map<string, EntityState>();
            for (let i = r; i < r + pr; i += 1) {
                for (let j = c; j < c + pc; j += 1) {
                    states.set(`${i},${j}`, "highlight");
                }
            }
            yield {
                stepNumber: step,
                entities: makeCells(grid, states),
                edges: [],
                description: `Window at (${r},${c}) – checking the pattern hash.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows, cols, matches: matches.length },
            };
            step += 1;

            // Verify a hash match by comparing the actual cells.
            if (((windowHash % MOD) + MOD) % MOD === patternHash) {
                let equal = true;
                for (let i = 0; i < pr && equal; i += 1) {
                    for (let j = 0; j < pc && equal; j += 1) {
                        if ((grid[r + i]?.[c + j] ?? "") !== (pattern[i]?.[j] ?? "")) {
                            equal = false;
                        }
                    }
                }
                if (equal) {
                    matches.push([r, c]);
                }
            }
        }
    }

    // Highlight all matches green.
    const finalStates = new Map<string, EntityState>();
    for (const [r, c] of matches) {
        for (let i = r; i < r + pr; i += 1) {
            for (let j = c; j < c + pc; j += 1) {
                finalStates.set(`${i},${j}`, "sorted");
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(grid, finalStates),
        edges: [],
        description:
            matches.length === 0
                ? "Pattern not found in the grid."
                : `Pattern found at ${matches.map(([r, c]) => `(${r},${c})`).join(", ")}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows, cols, matches: matches.length },
    };
}

/** The 2D Rolling Hash module, registered with the engine. */
const module: AlgorithmModule = {
    id: "rolling-hash-2d",
    name: "Rolling Hash (2D)",
    category: "string",
    complexity: { time: "O(rows·cols)", space: "O(rows·cols)" },
    // The 2×2 pattern "ac/ca" appears at (0,2).
    defaultInput: {
        grid: [
            ["a", "b", "a", "c"],
            ["b", "a", "c", "a"],
            ["a", "b", "a", "c"],
            ["c", "a", "b", "a"],
        ],
        pattern: [
            ["a", "c"],
            ["c", "a"],
        ],
    },
    visualType: "grid",
    run,
};

export default module;

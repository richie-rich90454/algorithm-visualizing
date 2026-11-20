/**
 * columnar-transposition.ts - Columnar Transposition Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A columnar transposition hides a message by changing letter order rather
 * than letter identity. Encryption writes the plaintext row by row into a
 * rectangle of a fixed number of columns, pads a short final row, and reads
 * the rectangle out column by column. Decryption reverses the process: it
 * refills the same rectangle column by column and reads it row by row, then
 * strips the padding. The message length and column count must be shared.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a message of n characters
 *   Space: O(n) for the grid and the output text
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the rectangle, one character per cell.
 *   - A cell is CYAN while it is written or read, GREEN once settled.
 *   - The final frame reports the full transposed text.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "encrypt" | "decrypt";

/** Fill a rectangle row-wise, then read it column-wise. */
function encrypt(text: string, columns: number, padding: string): { grid: string[][]; output: string } {
    const chars = [...text];
    const rows = Math.ceil(chars.length / columns);
    const grid: string[][] = [];
    for (let r = 0; r < rows; r += 1) {
        const row: string[] = [];
        for (let c = 0; c < columns; c += 1) row.push(chars[r * columns + c] ?? padding);
        grid.push(row);
    }
    const output: string[] = [];
    for (let c = 0; c < columns; c += 1) {
        for (let r = 0; r < rows; r += 1) output.push(grid[r]?.[c] ?? padding);
    }
    return { grid, output: output.join("") };
}

/** Refill a rectangle column-wise, then read it row-wise and strip padding. */
function decrypt(text: string, columns: number, padding: string): { grid: string[][]; output: string } {
    const chars = [...text];
    const rows = Math.ceil(chars.length / columns);
    const grid: string[][] = [];
    for (let r = 0; r < rows; r += 1) grid.push(Array.from({ length: columns }, () => padding));
    for (let c = 0; c < columns; c += 1) {
        for (let r = 0; r < rows; r += 1) {
            const gridRow = grid[r];
            if (gridRow) gridRow[c] = chars[c * rows + r] ?? padding;
        }
    }
    const output: string[] = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < columns; c += 1) output.push(grid[r]?.[c] ?? padding);
    }
    const padded = output.join("");
    return { grid, output: padded.split(padding)[0] ?? padded };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { text?: string; columns?: number; mode?: Mode; padding?: string } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "ATTACKATDAWN";
    const columns = Math.max(1, Math.floor(task.columns ?? 4));
    const mode: Mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const padding = typeof task.padding === "string" && task.padding.length === 1 ? task.padding : "X";
    const result = mode === "encrypt" ? encrypt(text, columns, padding) : decrypt(text, columns, padding);
    const rows = result.grid.length;

    const cells = (activeRow: number, activeCol: number, phase: "init" | "fill" | "read" | "final"): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < columns; c += 1) {
                const isActive = r === activeRow && c === activeCol;
                let state: EntityState = phase === "final" ? "sorted" : "idle";
                if (phase === "fill" && isActive) state = "active";
                if (phase === "read" && isActive) state = "comparing";
                if (phase === "fill" && !isActive && r * columns + c < text.length) state = "sorted";
                entities.push({
                    id: `cell-${r}-${c}`,
                    type: "cell" as const,
                    label: result.grid[r]?.[c] ?? padding,
                    value: result.grid[r]?.[c] ?? padding,
                    state: mode === "decrypt" ? (phase === "final" ? "sorted" : "idle") : state,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col: c, char: result.grid[r]?.[c] ?? padding },
                });
            }
        }
        return entities;
    };

    const commonMeta = { rows, cols: columns, mode, padding, columns };

    yield {
        stepNumber: 0,
        entities: cells(-1, -1, "init"),
        edges: [],
        description: `${mode === "encrypt" ? "Encrypting" : "Decrypting"} ${[...text].length} character(s) in a ${rows} by ${columns} rectangle.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...commonMeta, phase: "init", output: "" },
    };
    let step = 1;
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < columns; c += 1) {
            yield {
                stepNumber: step,
                entities: cells(r, c, "fill"),
                edges: [],
                description: `${mode === "encrypt" ? "Writing" : "Placing"} character at row ${r}, column ${c}: "${result.grid[r]?.[c] ?? padding}".`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { ...commonMeta, phase: "fill", row: r, col: c },
            };
            step += 1;
        }
    }
    const readCount = rows * columns;
    for (let i = 0; i < readCount; i += 1) {
        const r = mode === "encrypt" ? i % rows : Math.floor(i / columns);
        const c = mode === "encrypt" ? Math.floor(i / rows) : i % columns;
        yield {
            stepNumber: step,
            entities: cells(r, c, "read"),
            edges: [],
            description: `Reading rectangle position ${i} from row ${r}, column ${c}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { ...commonMeta, phase: "read", row: r, col: c },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: cells(-1, -1, "final"),
        edges: [],
        description: `Columnar ${mode} complete: "${result.output}".`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...commonMeta, phase: "final", output: result.output },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of changing letters, a transposition cipher rearranges them. Imagine writing the message across a grid with a fixed number of columns, then reading down each column instead of across each row. The letters are all still there, just in a different order. The receiver needs the same number of columns to rebuild the grid and read the message back.",
        invariants: [
            "The grid always has the same multiset of characters as the input, with padding filling the last row.",
            "Encryption reads columns while decryption writes columns, so the two operations cancel.",
            "Only letter order changes; no character value is substituted.",
        ],
        correctness:
            "Encryption places character at index r times columns plus c into grid cell (r,c), and emits cells in column-major order. Decryption deposits the ciphertext back into the same column-major positions and reads row-major order, which is the exact inverse permutation. Removing the final padding returns the original message whenever the same column count is used.",
        complexityRationale:
            "Writing the grid and reading it back each touch every cell once, so both directions run in linear time. The rectangle stores one character per cell, giving linear space.",
        uses: [
            "Teaching classical transposition and permutation ciphers",
            "Double transposition schemes combined with substitution",
            "Puzzle ciphers and historical cryptanalysis exercises",
        ],
        references: [
            "Kahn, The Codebreakers",
            "Wikipedia, Transposition cipher, columnar transposition",
        ],
        workedExample:
            "Writing ATTACKATDAWN in four columns gives rows ATTA, CKAT, DAWN, so the grid is complete. Reading columns gives ACDTKATAWATN, which decrypts back to ATTACKATDAWN with the same column count.",
    },
    id: "columnar-transposition",
    name: "Columnar Transposition Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "ATTACKATDAWN", columns: 4, mode: "encrypt", padding: "X" },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a column count and write the text row by row",
        "pad the final row if it is short",
        "for encryption read the grid column by column",
        "for decryption refill the grid column by column",
        "read the refilled grid row by row",
        "remove trailing padding characters",
        "done: return the transposed text",
    ],
};

export default module;

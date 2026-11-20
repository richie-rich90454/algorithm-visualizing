/**
 * rail-fence-cipher.ts - Rail Fence Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The rail fence cipher is a transposition cipher. Plaintext letters are
 * written in a zigzag across a number of rails, then read off row by row to
 * form the ciphertext. Decryption rebuilds the zigzag positions and drops the
 * ciphertext letters back into them. No letter is substituted; only positions
 * change.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n characters
 *   Space: O(n) for the zigzag grid and the output
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid shows rails as rows and plaintext positions as columns.
 *   - The cell receiving the current letter is highlighted.
 *   - The final frame reports the ciphertext read row by row.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mode = "encrypt" | "decrypt";

/** Rail index for a zigzag of the given height at position i. */
function railAt(i: number, rails: number): number {
    const cycle = 2 * (rails - 1);
    if (cycle === 0) return 0;
    const offset = i % cycle;
    return offset < rails ? offset : cycle - offset;
}

/** The rail fence cipher module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; rails?: number; mode?: Mode } | null) ?? {};
    const text = typeof task.text === "string" ? task.text : "WEAREDISCOVEREDFLEEONCE";
    const rails = Math.max(1, Math.min(Math.max(1, text.length), Math.floor(task.rails ?? 3)));
    const mode: Mode = task.mode === "decrypt" ? "decrypt" : "encrypt";
    const chars = [...text];
    const n = chars.length;
    const grid: string[][] = Array.from({ length: rails }, () => new Array<string>(n).fill(""));
    const railSequence = Array.from({ length: n }, (_, i) => railAt(i, rails));
    const output: string[] = [];
    const filled = new Set<number>();

    const entities = (highlight: number | null): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        for (let r = 0; r < rails; r += 1) {
            for (let c = 0; c < n; c += 1) {
                const position = r * n + c;
                let state: EntityState = "idle";
                if (grid[r]?.[c]) state = highlight === position ? "active" : "visited";
                cells.push({
                    id: `cell-${r}-${c}`,
                    type: "cell" as const,
                    label: grid[r]?.[c] ?? "",
                    value: grid[r]?.[c] ?? "",
                    state,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col: c, rail: r, position: c, filled: Boolean(grid[r]?.[c]) },
                });
                filled.add(position);
            }
        }
        return cells;
    };

    yield {
        stepNumber: 0,
        entities: entities(null),
        edges: [],
        description: `${mode === "encrypt" ? "Encrypting" : "Decrypting"} ${n} character(s) on ${rails} rail(s) with a zigzag pattern.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: rails, cols: n, rails, mode, output: "", railSequence },
    };
    let step = 1;

    if (mode === "encrypt") {
        for (let i = 0; i < n; i += 1) {
            const r = railSequence[i] as number;
            (grid[r] as string[])[i] = chars[i] as string;
            yield {
                stepNumber: step,
                entities: entities(r * n + i),
                edges: [],
                description: `Placed ${JSON.stringify(chars[i])} on rail ${r} at column ${i} of the zigzag.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows: rails, cols: n, rails, mode, output: "", railSequence, index: i },
            };
            step += 1;
        }
        for (let r = 0; r < rails; r += 1) {
            for (let c = 0; c < n; c += 1) {
                const ch = grid[r]?.[c];
                if (ch) output.push(ch);
            }
            yield {
                stepNumber: step,
                entities: entities(null),
                edges: [],
                description: `Reading rail ${r} left to right adds ${grid[r]?.filter(Boolean).length || 0} character(s) to the ciphertext.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { rows: rails, cols: n, rails, mode, output: output.join(""), railSequence },
            };
            step += 1;
        }
    } else {
        const lengths = grid.map((_, r) => railSequence.filter((value) => value === r).length);
        const rowStrings: string[] = [];
        let cursor = 0;
        for (let r = 0; r < rails; r += 1) {
            const length = lengths[r] as number;
            rowStrings.push(text.slice(cursor, cursor + length));
            cursor += length;
            yield {
                stepNumber: step,
                entities: entities(null),
                edges: [],
                description: `Rail ${r} receives ${length} ciphertext character(s): "${rowStrings[r]}".`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { rows: rails, cols: n, rails, mode, output: "", railSequence, rowStrings: rowStrings.slice() },
            };
            step += 1;
        }
        for (let i = 0; i < n; i += 1) {
            const r = railSequence[i] as number;
            const used = railSequence.slice(0, i).filter((value) => value === r).length;
            const ch = (rowStrings[r] as string)[used] ?? "";
            (grid[r] as string[])[i] = ch;
            output.push(ch);
            yield {
                stepNumber: step,
                entities: entities(r * n + i),
                edges: [],
                description: `Restored position ${i} from rail ${r} with character ${JSON.stringify(ch)}.`,
                codeLineNumber: 5,
                layout: "grid",
                meta: { rows: rails, cols: n, rails, mode, output: output.join(""), railSequence, rowStrings },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: entities(null),
        edges: [],
        description: `Rail fence ${mode} complete: "${output.join("")}".`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: rails, cols: n, rails, mode, output: output.join(""), railSequence, filled: filled.size },
    };
}

/** The rail fence cipher module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of replacing letters, the rail fence cipher moves them. Imagine writing the message as a zigzag path down and up across several rails, then reading the rails one after another. The ciphertext looks scrambled, but the zigzag geometry is a perfect permutation, so knowing the number of rails lets the receiver put every letter back.",
        invariants: [
            "The zigzag visits rail indices in a fixed repeating pattern.",
            "Every plaintext position maps to exactly one grid cell.",
            "Reading the filled grid row by row yields the ciphertext.",
        ],
        correctness:
            "The rail sequence is periodic with period 2r - 2 and hits each position once, so writing letters along it is a bijection from positions to grid cells. Concatenating the rails produces a permutation of the plaintext. Decryption recomputes the same sequence, splits the ciphertext into pieces whose lengths equal the number of visits to each rail, and assigns the j-th character of a rail to the j-th visit, which is the inverse permutation.",
        complexityRationale:
            "Writing, reading, and restoring each visit the pattern once per character, so both directions are O(n). The grid holds one slot per rail per position, giving O(rails * n) displayed space and O(n) space for the permutation itself.",
        uses: [
            "Teaching transposition as the counterpart of substitution",
            "Classical cryptography exercises with hand ciphers",
            "Understanding why permutation-only ciphers preserve letter frequencies",
        ],
        references: [
            "Kahn, The Codebreakers",
            "Wikipedia, Rail fence cipher",
        ],
        workedExample:
            "Writing the five letters HELLO on three rails visits rails 0, 1, 2, 1, 0. Filling them gives rail 0 = HO, rail 1 = EL, rail 2 = L, so the ciphertext is HOELL. Decryption splits it into lengths 2, 2, 1 and restores the zigzag to HELLO.",
    },
    id: "rail-fence-cipher",
    name: "Rail Fence Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { text: "WEAREDISCOVEREDFLEEONCE", rails: 3, mode: "encrypt" },
    visualType: "grid",
    run,
    pseudocode: [
        "choose the number of rails",
        "compute the zigzag rail for each position",
        "write each plaintext letter on its rail",
        "split the ciphertext by rail visit counts",
        "read each rail left to right to form the output",
        "restore each position from its rail during decryption",
        "done: return the transformed message",
    ],
};

export default module;

/**
 * burrows-wheeler-inverse-transform.ts - Inverse Burrows-Wheeler Transform
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The inverse Burrows-Wheeler transform rebuilds the original string from the
 * last column of the sorted rotations. It forms the first column by sorting the
 * last column, builds the LF-mapping that jumps from one row to the row of the
 * suffix one character earlier, and walks that permutation from the sentinel
 * row, prepending one character at a time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for n characters, dominated by sorting the column
 *   Space: O(n) for the two displayed columns and the mapping
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A two-row grid shows the last column L above the first column F.
 *   - The current row is YELLOW in both rows; the reconstructed prefix is in meta.
 *   - The final frame is GREEN and reports the recovered text.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Forward BWT, used only to turn an optional text input into a last column. */
function forwardBwt(text: string): string {
    const terminated = text.endsWith("$") ? text : `${text}$`;
    const n = terminated.length;
    const rotations = Array.from({ length: n }, (_, i) => terminated.slice(i) + terminated.slice(0, i));
    rotations.sort();
    return rotations.map((row) => row[row.length - 1] ?? "").join("");
}

function makeCells(l: string, f: string, active: number | null, done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        const column = row === 0 ? l : f;
        for (let col = 0; col < column.length; col += 1) {
            let state: EntityState = "idle";
            if (done) {
                state = "sorted";
            } else if (active === col) {
                state = "comparing";
            }
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: column[col] ?? "",
                value: column[col] ?? "",
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, char: column[col] ?? "" },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bwt?: string; text?: string } | null) ?? {};
    const bwt = typeof task.bwt === "string"
        ? task.bwt
        : forwardBwt(typeof task.text === "string" ? task.text : "banana$");
    const n = bwt.length;
    const characters = [...bwt];
    const f = [...characters].sort().join("");

    const total = new Map<string, number>();
    for (const char of characters) total.set(char, (total.get(char) ?? 0) + 1);
    const alphabet = [...total.keys()].sort();
    const first = new Map<string, number>();
    let offset = 0;
    for (const char of alphabet) {
        first.set(char, offset);
        offset += total.get(char) ?? 0;
    }

    const lf: number[] = [];
    const seen = new Map<string, number>();
    for (let i = 0; i < n; i += 1) {
        const char = characters[i] ?? "";
        const rank = seen.get(char) ?? 0;
        lf.push((first.get(char) ?? 0) + rank);
        seen.set(char, rank + 1);
    }

    let row = f.indexOf("$");
    if (row < 0) row = 0;
    let recovered = "";
    let step = 0;

    const frame = (
        active: number | null,
        done: boolean,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(bwt, f, active, done),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: { n, l: bwt, f, row, recovered, ...extra },
    });

    yield frame(null, false, `Rebuilding the original text from a last column of ${n} character(s).`, 0);
    step += 1;
    yield frame(null, false, `The first column F is the sorted last column: "${f}".`, 1, { row });
    step += 1;

    for (let k = 0; k < n; k += 1) {
        const char = f[row] ?? "";
        recovered = char + recovered;
        const next = lf[row] ?? 0;
        yield frame(row, false, `Row ${row}: prepend "${char}", giving "${recovered}", then follow LF to row ${next}.`, 4, { row: next, recovered });
        step += 1;
        row = next;
    }

    yield frame(null, true, `Recovered "${recovered}" from the Burrows-Wheeler last column.`, 6, { row, recovered });
}

/** The inverse Burrows-Wheeler transform module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The Burrows-Wheeler transform throws away the rotations and keeps only their last column, yet the original text can be recovered. Sorting that column gives the first column, and matching identical characters in the two columns defines a permutation that walks backward through the text one character at a time. Starting at the sentinel and following the permutation spells out the text in reverse.",
        invariants: [
            "The first column is exactly the last column sorted.",
            "The LF mapping is a permutation: each row of F points to a distinct row.",
            "Each step prepends one character, so the prefix grows by one each iteration.",
        ],
        correctness:
            "Identical characters keep their relative order in F and L because the rotations are sorted lexicographically. The LF mapping sends row i to the row whose rotation starts one character earlier, which is first of char plus the number of that char seen before i. Starting from the sentinel row, that is the full original string, so each LF step moves one character backward and prepending the F character reconstructs the string exactly after n steps.",
        complexityRationale:
            "Sorting the n characters of the last column takes O(n log n), and building and walking the LF permutation is linear, giving O(n log n) time and O(n) space for the columns and mapping.",
        uses: [
            "Decompressing BWT-compressed genomic data",
            "Inverting the transform in the bzip2 decompression pipeline",
            "Reconstructing reads in suffix-array based aligners",
        ],
        references: [
            "Burrows and Wheeler, A Block-Sorting Lossless Data Compression Algorithm, 1994",
            "Navarro and Makinen, Compressed Full-Text Indexes, 2007",
        ],
        workedExample:
            "For the text aba$ the sorted rotations are $aba, a$ab, aba$, ba$a, so the last column L is ab$a. Sorting gives F = $aab. Following LF from row zero yields the characters a, b, a, $ when prepended in turn, recovering aba$.",
    },
    id: "burrows-wheeler-inverse-transform",
    name: "Burrows-Wheeler Inverse Transform",
    category: "string",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { text: "banana$" },
    visualType: "grid",
    run,
    pseudocode: [
        "read the last column L of the sorted rotations",
        "form the first column F by sorting the characters of L",
        "count each character and record the first row where it appears in F",
        "for every row set LF to that first row plus the count of the character before it",
        "start at the row of the sentinel character in F",
        "repeat n times: prepend F at the current row and move to LF at that row",
        "done: report the recovered original text",
    ],
};

export default module;

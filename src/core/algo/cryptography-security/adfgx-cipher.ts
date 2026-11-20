/**
 * adfgx-cipher.ts - ADFGX Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The ADFGX cipher is a fractionating cipher used by the German army in 1918.
 * A five by five Polybius square, keyed by a keyword and merging I with J,
 * turns each plaintext letter into a pair of coordinates drawn from the five
 * letters A, D, F, G and X. The resulting string of pairs is then broken into
 * rows under a transposition keyword and the columns are read in alphabetical
 * key order. Decryption reverses the column order and maps the coordinate pairs
 * back to letters. ADFGX is the five by five predecessor of the six by six
 * ADFGVX cipher.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + k log k) for n characters and a transposition key of length k
 *   Space: O(n) for the coordinate string and the transposed rows
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character entity per input symbol.
 *   - The letter being fractionated or untransposed is highlighted.
 *   - meta carries the square, coordinate string and final text.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const COORDS = ["A", "D", "F", "G", "X"];
const ALPHABET = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

interface AdfgxInput {
    text?: string;
    squareKey?: string;
    transpositionKey?: string;
    mode?: string;
}

/** Normalize a keyword to uppercase letters with I folded into J. */
function normalizeKey(key: string): string {
    return [...key.toUpperCase()].map((ch) => (ch === "J" ? "I" : ch)).filter((ch) => ch >= "A" && ch <= "Z").join("");
}

/** Build the twenty-five letter Polybius square from a keyword. */
function buildSquare(key: string): string {
    const seen = new Set<string>();
    const letters: string[] = [];
    for (const ch of normalizeKey(key) + ALPHABET) {
        if (!seen.has(ch)) {
            seen.add(ch);
            letters.push(ch);
        }
    }
    return letters.slice(0, 25).join("");
}

/** Map a message to coordinate pairs, leaving nonletters unchanged. */
function fractionate(text: string, square: string): string {
    let out = "";
    for (const raw of text.toUpperCase()) {
        const ch = raw === "J" ? "I" : raw;
        const index = square.indexOf(ch);
        if (index < 0) {
            out += raw;
            continue;
        }
        out += COORDS[Math.floor(index / 5)]! + COORDS[index % 5]!;
    }
    return out;
}

/** Map coordinate pairs back to letters. */
function unravel(text: string, square: string): string {
    let out = "";
    for (let i = 0; i < text.length; i += 1) {
        const row = COORDS.indexOf(text[i] ?? "");
        const col = COORDS.indexOf(text[i + 1] ?? "");
        if (row < 0 || col < 0 || i + 1 >= text.length) {
            out += text[i] ?? "";
            continue;
        }
        out += square[row * 5 + col] ?? "";
        i += 1;
    }
    return out;
}

/** Column order sorted alphabetically by key letter, breaking ties left to right. */
function columnOrder(key: string): number[] {
    return [...key]
        .map((ch, i) => ({ ch, i }))
        .sort((a, b) => (a.ch === b.ch ? a.i - b.i : a.ch < b.ch ? -1 : 1))
        .map((entry) => entry.i);
}

/** Apply or undo a columnar transposition with an 'A' fill character. */
function transpose(text: string, key: string, decrypt: boolean): string {
    const cols = Math.max(1, key.length);
    const rows = Math.ceil(text.length / cols);
    const order = columnOrder(key);
    if (!decrypt) {
        const grid = Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => text[r * cols + c] ?? "A"),
        );
        let out = "";
        for (const c of order) for (let r = 0; r < rows; r += 1) out += grid[r]![c];
        return out;
    }
    const padded = text.padEnd(rows * cols, "A");
    const grid = Array.from({ length: rows }, () => new Array<string>(cols).fill("A"));
    let cursor = 0;
    for (const c of order) for (let r = 0; r < rows; r += 1) grid[r]![c] = padded[cursor++] ?? "A";
    return grid.map((row) => row.join("")).join("");
}

/** Build one character entity per visible symbol. */
function makeChars(chars: string[], focus: number, state: EntityState): VisualEntity[] {
    return chars.map((ch, i) => ({
        id: `char-${i}`,
        type: "character" as const,
        label: ch,
        value: ch,
        state: (i === focus ? state : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, symbol: ch },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AdfgxInput | null) ?? {};
    const squareKey = String(task.squareKey ?? "keyword");
    const transpositionKey = String(task.transpositionKey ?? "cats");
    const mode = String(task.mode ?? "encrypt") === "decrypt" ? "decrypt" : "encrypt";
    const square = buildSquare(squareKey);
    const source = String(task.text ?? (mode === "encrypt" ? "ATTACKATDAWN" : "FAGGFDDDFFFAFAAGADAFD")).toUpperCase();

    const chars = [...source];
    let step = 0;
    const emit = (description: string, codeLine: number, focus: number, state: EntityState, visible: string[], extra: Record<string, unknown>) => ({
        stepNumber: step++,
        entities: makeChars([...visible], focus, state),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "text" as const,
        meta: {
            square,
            squareKey: normalizeKey(squareKey),
            transpositionKey: transpositionKey.toUpperCase(),
            mode,
            ...extra,
        },
    });

    yield emit(`ADFGX ${mode} with square key "${squareKey}" and transposition key "${transpositionKey}".`, 0, -1, "idle", chars, { input: source });

    if (mode === "encrypt") {
        let pairs = "";
        for (let i = 0; i < chars.length; i += 1) {
            const ch = chars[i] === "J" ? "I" : chars[i]!;
            const at = square.indexOf(ch);
            const pair = at >= 0 ? COORDS[Math.floor(at / 5)]! + COORDS[at % 5]! : chars[i]!;
            pairs += pair;
            yield emit(`Letter "${chars[i]}" maps to square coordinates ${pair}.`, 2, i, "active", chars, { pairs: pairs.slice() });
        }
        const cipher = transpose(pairs, transpositionKey.toUpperCase(), false);
        yield emit(`Read the transposed columns in key order to get ${cipher}.`, 4, -1, "sorted", [...cipher], { pairs, ciphertext: cipher });
        yield emit(`Encrypted ${chars.length} letter(s) into ${cipher.length} coordinate symbol(s).`, 6, -1, "sorted", [...cipher], { pairs, ciphertext: cipher, output: cipher });
        return;
    }

    const undone = transpose(source, transpositionKey.toUpperCase(), true);
    yield emit(`Undo the columnar transposition to recover the coordinate pairs ${undone}.`, 2, -1, "active", [...undone], { undone });
    const plain = unravel(undone, square);
    yield emit(`Map the coordinate pairs back through the square to read ${plain}.`, 4, -1, "sorted", [...plain], { undone, plaintext: plain });
    yield emit(`Decrypted ${undone.length} coordinate symbol(s) into ${plain.length} letter(s).`, 6, -1, "sorted", [...plain], { undone, plaintext: plain, output: plain });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "First replace every letter with two coordinates from a five by five square, so a single letter becomes a pair of symbols. Then scramble those symbols with columnar transposition. Fractionation hides single-letter frequencies and transposition breaks the adjacency of the two halves of a pair, which is why ADFGX was much stronger than a simple substitution. The recipient undoes the columns first and only then reads the coordinates back as letters.",
        invariants: [
            "The Polybius square holds twenty-five letters with I and J merged.",
            "Every alphabetic plaintext character produces exactly two coordinate symbols.",
            "Transposition permutes symbols without changing their multiset.",
        ],
        correctness:
            "The square is a bijection between the twenty-five letters and coordinate pairs, so fractionation loses no information for letters. Columnar transposition writes the symbols into a rectangular grid and reads whole columns in a key-determined order, which is a permutation of positions and therefore invertible when the column order is known. Decryption applies the inverse permutation, including the same fill character, and then the inverse square map, returning the original message up to the documented I and J merge and trailing fill.",
        complexityRationale:
            "Fractionation scans n characters once and transposition builds a grid of n cells, so both are linear in the message length. Sorting the transposition key of length k costs O(k log k), giving O(n + k log k) time and O(n) space for the intermediate string.",
        uses: [
            "Study of World War I field ciphers and the fractionating-transposition lineage",
            "Teaching the combination of substitution and transposition",
            "Historical cryptanalysis exercises on the ADFGX and ADFGVX family",
        ],
        references: [
            "Kahn, The Codebreakers, chapter on World War I cryptography",
            "Bauer, Secret History: The Story of Cryptology, chapter on fractionating ciphers",
        ],
        workedExample:
            "With the square keyed by KEYWORD, the letter A might sit at row A column D and become AD, while T becomes FG. After the whole message is converted, the coordinate string is written in rows under the key ZEBRA and the columns are read in the order dictated by the alphabetical key letters. The receiver rebuilds the rows, pairs up symbols such as A and D, and reads row A column D back as A.",
    },
    id: "adfgx-cipher",
    name: "ADFGX Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n + k log k)", space: "O(n)" },
    defaultInput: {
        text: "ATTACKATDAWN",
        squareKey: "keyword",
        transpositionKey: "cats",
        mode: "encrypt",
    },
    visualType: "text",
    run,
    pseudocode: [
        "build a keyed five by five square merging I and J",
        "for each plaintext letter find its row and column in the square",
        "write the two coordinate letters A, D, F, G or X",
        "write the coordinate string into rows under the transposition key",
        "read out whole columns in alphabetical key order",
        "to decrypt, rebuild the rows using the same key order",
        "read consecutive coordinate pairs back through the square",
        "done: report the transformed message",
    ],
};

export default module;

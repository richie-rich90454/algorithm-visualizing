/**
 * trifid-cipher.ts - Trifid Cipher
 *
 * A classical fractionating cipher that maps each letter into a three-digit
 * coordinate in a three-by-three-by-three cube. The coordinate streams are
 * written in three rows (layers, rows, columns) and then read back in groups
 * of three to form new letters. Decryption reverses the fractionation. The
 * core is fully implemented; it is a teaching cipher, not a secure one.
 *
 * Complexity:
 *   Time:  O(n) for n plaintext letters
 *   Space: O(n) for the intermediate digit stream
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ALPHABET = "ABCDEFGHIKLMNOPQRSTUVWXYZ01";

function clean(text: string): string {
    return text.toUpperCase().replace(/J/g, "I").replace(/[^A-Z0-9]/g, "");
}

function buildCube(keyword: string): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const ch of clean(keyword) + ALPHABET) {
        if (!seen.has(ch)) {
            seen.add(ch);
            result.push(ch);
        }
    }
    return result.slice(0, 27);
}

function coords(cube: string[], letter: string): [number, number, number] {
    const index = cube.indexOf(letter);
    return [Math.floor(index / 9), Math.floor((index % 9) / 3), index % 3];
}

function digitToLetter(cube: string[], a: number, b: number, c: number): string {
    return cube[a * 9 + b * 3 + c] ?? "A";
}

function letterToIndex(cube: string[], letter: string): number {
    return cube.indexOf(letter);
}

function fractionate(cube: string[], text: string): string {
    const layers: number[] = [];
    const rows: number[] = [];
    const cols: number[] = [];
    for (const ch of text) {
        const [l, r, c] = coords(cube, ch);
        layers.push(l);
        rows.push(r);
        cols.push(c);
    }
    const stream = [...layers, ...rows, ...cols];
    const out: string[] = [];
    for (let i = 0; i + 2 < stream.length; i += 3) {
        out.push(digitToLetter(cube, stream[i] ?? 0, stream[i + 1] ?? 0, stream[i + 2] ?? 0));
    }
    return out.join("");
}

function unfold(cube: string[], cipher: string): string {
    const layers: number[] = [];
    const rows: number[] = [];
    const cols: number[] = [];
    for (const ch of cipher) {
        const idx = letterToIndex(cube, ch);
        layers.push(Math.floor(idx / 9));
        rows.push(Math.floor((idx % 9) / 3));
        cols.push(idx % 3);
    }
    // Each cipher letter (layer, row, column) holds the digits at positions
    // 3j, 3j+1, 3j+2 of the original concatenated stream.
    const stream: number[] = [];
    for (let position = 0; position < layers.length * 3; position += 1) {
        const column = Math.floor(position / 3);
        if (position % 3 === 0) {
            stream.push(layers[column] ?? 0);
        } else if (position % 3 === 1) {
            stream.push(rows[column] ?? 0);
        } else {
            stream.push(cols[column] ?? 0);
        }
    }
    // Split back into the layer, row, and column rows, then read down each
    // column to recover the coordinate triple of every plaintext letter.
    const n = layers.length;
    const out: string[] = [];
    for (let i = 0; i < n; i += 1) {
        out.push(digitToLetter(cube, stream[i] ?? 0, stream[n + i] ?? 0, stream[2 * n + i] ?? 0));
    }
    return out.join("");
}

function makeCells(cube: string[], active: Set<string>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let index = 0; index < 27; index += 1) {
        const layer = Math.floor(index / 9);
        const within = index % 9;
        const row = Math.floor(within / 3);
        const col = within % 3;
        const id = `cell-${layer * 3 + row}-${col}`;
        const letter = cube[index] ?? "A";
        const state: EntityState = active.has(id) ? "active" : "sorted";
        entities.push({
            id,
            type: "cell",
            label: letter,
            value: letter,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: layer * 3 + row, col, layer, cubeRow: row, cubeCol: col },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { plaintext?: string; key?: string } | null) ?? {};
    const plain = clean(String(task.plaintext ?? "ATTACKATDAWN"));
    const cube = buildCube(String(task.key ?? "TRIFID"));
    const ciphertext = fractionate(cube, plain);
    const recovered = unfold(cube, ciphertext);
    const base = { rows: 9, cols: 3, chars: plain.length };

    yield {
        stepNumber: 0,
        entities: makeCells(cube, new Set()),
        edges: [],
        description: "Three layers of three-by-three cells hold the 27-symbol cube.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "cube", ciphertext: "" },
    };

    for (let i = 0; i < plain.length; i += 1) {
        const [layer, row, col] = coords(cube, plain[i] ?? "A");
        const active = new Set([`cell-${layer * 3 + row}-${col}`]);
        yield {
            stepNumber: i + 1,
            entities: makeCells(cube, active),
            edges: [],
            description: `Letter ${i}: ${plain[i]} has coordinates ${layer}, ${row}, ${col} in the cube.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { ...base, phase: "fractionate", index: i, ciphertext: "" },
        };
    }

    yield {
        stepNumber: plain.length + 1,
        entities: makeCells(cube, new Set()),
        edges: [],
        description: `Reading layers, rows, then columns in triples gives ${ciphertext}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...base, phase: "done", ciphertext, plaintext: recovered },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Trifid spreads each letter across three dimensions. Every letter lives in a three-by-three-by-three cube, so it can be named by a layer, a row, and a column. If you write out all the layer numbers, then all the row numbers, then all the column numbers, and chop the long stream back into triples, new letters appear. Those new letters are the ciphertext.",
        invariants: [
            "The cube contains 27 distinct symbols, each with a unique three-digit coordinate.",
            "Each plaintext letter contributes exactly one digit to each of the three streams.",
            "The three streams have equal length, so regrouping into triples loses no digits.",
        ],
        correctness:
            "Encryption maps each letter to its unique coordinate triple, writes the layer, row, and column digits in three rows, concatenates those rows, and reads the result in triples to form ciphertext letters. Decryption splits every ciphertext letter back into its three digits, interleaves them column by column to rebuild the concatenated stream, cuts that stream back into the three equal rows, and reads down each column to recover a plaintext coordinate triple. Because the layer-row-column map is a bijection on the 27 cells, this restores every original letter, so decryption is the exact inverse of encryption.",
        complexityRationale:
            "The cube is built with one scan of the key and alphabet. Fractionation scans the n letters once and emits a stream of 3n digits, which is then read in constant-time triples, giving O(n) time and O(n) space for the digit stream and output.",
        uses: [
            "Historical field encryption combining substitution and fractionation",
            "Teaching multi-dimensional fractionation and transposition",
            "A classroom comparison with bifid and ADFGVX",
        ],
        references: [
            "Delistre, Cryptography and Cryptanalysis, 1955",
            "Kahn, The Codebreakers, Chapter 5",
        ],
        workedExample:
            "With a cube keyed by TRIFID, a letter in layer one, row two, column zero contributes the digits one, two, zero. Collecting those digits for every letter and reading them back in triples yields the ciphertext letters; reversing the process restores the original word.",
    },
    id: "trifid-cipher",
    name: "Trifid Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { plaintext: "ATTACKATDAWN", key: "TRIFID" },
    visualType: "grid",
    run,
    pseudocode: [
        "build the three-by-three-by-three cube from the key",
        "for each letter record its layer, row, and column digits",
        "write all layer digits, then all row digits, then all column digits",
        "split the long digit stream into groups of three",
        "map each group to the cube letter at those coordinates",
        "to decrypt split each letter back into three digits",
        "rebuild the three streams and regroup into triples",
        "done: output the recovered plaintext",
    ],
};

export default module;

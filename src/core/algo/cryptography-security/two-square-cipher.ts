/**
 * two-square-cipher.ts - Two-Square Cipher (Double Playfair)
 *
 * A classical digraph cipher that places two five-by-five key squares side by
 * side. A pair of plaintext letters is located in the two squares and then
 * shifted along a row, shifted down a column, or swapped across the rectangle
 * the pair defines. Decryption applies the opposite shifts. It is a real,
 * fully implemented historical cipher, not a modern secure construction.
 *
 * Complexity:
 *   Time:  O(n) for n plaintext letters
 *   Space: O(n) for the ciphertext
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ALPHABET = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

function clean(text: string): string {
    return text.toUpperCase().replace(/J/g, "I").replace(/[^A-Z]/g, "");
}

function square(keyword: string): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const letter of clean(keyword) + ALPHABET) {
        if (!seen.has(letter)) {
            seen.add(letter);
            result.push(letter);
        }
    }
    return result;
}

function locate(sq: string[], letter: string): [number, number] {
    const at = sq.indexOf(letter);
    return [Math.floor(at / 5), at % 5];
}

type Pair = [string, string, number, number, number, number];

function encipherPair(a: string[], b: string[], pair: string): Pair {
    const [r1, c1] = locate(a, pair[0] ?? "A");
    const [r2, c2] = locate(b, pair[1] ?? "A");
    if (r1 === r2) {
        return [a[r1 * 5 + ((c1 + 1) % 5)] ?? "A", b[r2 * 5 + ((c2 + 1) % 5)] ?? "A", r1, c1, r2, c2];
    }
    if (c1 === c2) {
        return [a[((r1 + 1) % 5) * 5 + c1] ?? "A", b[((r2 + 1) % 5) * 5 + c2] ?? "A", r1, c1, r2, c2];
    }
    return [a[r1 * 5 + c2] ?? "A", b[r2 * 5 + c1] ?? "A", r1, c1, r2, c2];
}

function decipherPair(a: string[], b: string[], pair: string): string {
    const [r1, c2] = locate(a, pair[0] ?? "A");
    const [r2, c1] = locate(b, pair[1] ?? "A");
    if (r1 === r2) {
        return (a[r1 * 5 + ((c2 + 4) % 5)] ?? "A") + (b[r2 * 5 + ((c1 + 4) % 5)] ?? "A");
    }
    if (c2 === c1) {
        return (a[((r1 + 4) % 5) * 5 + c2] ?? "A") + (b[((r2 + 4) % 5) * 5 + c1] ?? "A");
    }
    return (a[r1 * 5 + c1] ?? "A") + (b[r2 * 5 + c2] ?? "A");
}

function makeCells(a: string[], b: string[], active: Set<string>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const squares: Array<[number, string[]]> = [
        [0, a],
        [5, b],
    ];
    for (const [baseCol, letters] of squares) {
        for (let row = 0; row < 5; row += 1) {
            for (let col = 0; col < 5; col += 1) {
                const id = `cell-${row}-${baseCol + col}`;
                const letter = letters[row * 5 + col] ?? "A";
                const state: EntityState = active.has(id) ? "active" : "sorted";
                entities.push({
                    id,
                    type: "cell",
                    label: letter,
                    value: letter.charCodeAt(0) - 65,
                    state,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col: baseCol + col },
                });
            }
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { plaintext?: string; keys?: string[] } | null) ?? {};
    const plain = clean(String(task.plaintext ?? "MEETMEATNOON"));
    const padded = plain.length % 2 === 1 ? `${plain}X` : plain;
    const keys = Array.isArray(task.keys) ? task.keys : [];
    const a = square(keys[0] ?? "EXAMPLE");
    const b = square(keys[1] ?? "KEYWORD");
    const base = { rows: 5, cols: 10, digraphs: padded.length / 2 };

    yield {
        stepNumber: 0,
        entities: makeCells(a, b, new Set()),
        edges: [],
        description: "Two key squares sit side by side; I and J share one cell in each.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "squares", ciphertext: "" },
    };

    const cipherPairs: string[] = [];
    for (let i = 0; i < padded.length; i += 2) {
        const pair = (padded[i] ?? "A") + (padded[i + 1] ?? "A");
        const [x, y, r1, c1, r2, c2] = encipherPair(a, b, pair);
        cipherPairs.push(x + y);
        const active = new Set([`cell-${r1}-${c1}`, `cell-${r2}-${5 + c2}`]);
        yield {
            stepNumber: i / 2 + 1,
            entities: makeCells(a, b, active),
            edges: [],
            description: `Pair ${i / 2}: ${pair} becomes ${x}${y} by the row, column, or rectangle rule.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { ...base, phase: "encrypt", digraph: i / 2, ciphertext: cipherPairs.join("") },
        };
    }

    const ciphertext = cipherPairs.join("");
    const recovered = cipherPairs.map((pair) => decipherPair(a, b, pair)).join("");
    yield {
        stepNumber: padded.length / 2 + 1,
        entities: makeCells(a, b, new Set()),
        edges: [],
        description: `Ciphertext ${ciphertext}; reversing every shift restores ${recovered}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, phase: "done", ciphertext, plaintext: recovered },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two-square encrypts letters in pairs using two alphabet squares. If the pair sits in a common row the letters step to the right; if it sits in a common column they step down; otherwise the two letters swap columns across the squares. The rule is reversible, so the same squares decrypt the message.",
        invariants: [
            "Each square holds the 25 merged alphabet letters exactly once.",
            "Letters in a common row shift right; letters in a common column shift down.",
            "Letters in different rows and columns swap their column positions.",
        ],
        correctness:
            "Every rule is a bijection on its square. A right shift of one is undone by a left shift of one, a downward shift is undone by an upward shift, and a column swap is its own inverse. Because the deciphering routine locates the ciphertext letters in the same squares and applies the exact opposite transformation, applying encryption then decryption returns the original padded pair for every pair, so the full message round trips.",
        complexityRationale:
            "The two squares are built with one constant-size scan each. Each of the n over two digraphs needs four lookups and a constant shift, so time is O(n); the output ciphertext occupies O(n) space.",
        uses: [
            "Historical diplomatic digraphic encryption",
            "Teaching polygraphic substitution with two squares",
            "A classroom comparison with Playfair and four-square",
        ],
        references: [
            "Kahn, The Codebreakers, Chapter 4",
            "Delistre, Cryptography and Cryptanalysis, 1955",
        ],
        workedExample:
            "With squares keyed by EXAMPLE and KEYWORD, a pair whose letters share a row is shifted one cell to the right in each square to produce the ciphertext pair. Moving one cell back during decryption restores the original letters.",
    },
    id: "two-square-cipher",
    name: "Two-Square Cipher",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { plaintext: "MEETMEATNOON", keys: ["EXAMPLE", "KEYWORD"] },
    visualType: "grid",
    run,
    pseudocode: [
        "merge I and J and build two five-by-five key squares",
        "pad the plaintext to an even length with X",
        "for each pair locate the letters in the two squares",
        "shift both letters right when they share a row",
        "shift both letters down when they share a column",
        "otherwise swap the two column positions",
        "done: reverse the rule to decrypt",
    ],
};

export default module;

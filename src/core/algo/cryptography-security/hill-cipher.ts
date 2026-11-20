/**
 * hill-cipher.ts - 2 by 2 Hill Cipher
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Hill cipher encrypts blocks of letters by treating each block as a vector
 * and multiplying it by a key matrix modulo 26. This module uses a 2 by 2 key:
 * a pair of letters becomes a pair of numbers, the matrix product is reduced
 * modulo 26, and the result maps back to letters. Decryption multiplies by the
 * modular inverse of the key matrix. This is a classical, fully implemented
 * cipher, not a secure modern primitive.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) for a message of m letters (constant work per block)
 *   Space: O(m) for the ciphertext and displayed characters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Characters are the padded plaintext letters, highlighted block by block.
 *   - The current block is ACTIVE; encrypted blocks are SORTED.
 *   - The ciphertext, key entries, and block numbers are reported in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HillInput {
    key?: number[][];
    message?: string;
}

function mod(value: number, m: number): number {
    return ((value % m) + m) % m;
}

/** Modular inverse of a determinant modulo 26, or minus one if none exists. */
function inverseMod26(value: number): number {
    for (let x = 0; x < 26; x += 1) {
        if (mod(value * x, 26) === 1) {
            return x;
        }
    }
    return -1;
}

/** Invert a 2 by 2 matrix modulo 26, or return null when not invertible. */
function inverseKey(key: number[][]): number[][] | null {
    const a = key[0]?.[0] ?? 0;
    const b = key[0]?.[1] ?? 0;
    const c = key[1]?.[0] ?? 0;
    const d = key[1]?.[1] ?? 0;
    const det = mod(a * d - b * c, 26);
    const detInv = inverseMod26(det);
    if (detInv < 0) {
        return null;
    }
    return [
        [mod(d * detInv, 26), mod(-b * detInv, 26)],
        [mod(-c * detInv, 26), mod(a * detInv, 26)],
    ];
}

/** Encrypt a pair of letter values with the key matrix. */
function encryptPair(key: number[][], p0: number, p1: number): [number, number] {
    const a = key[0]?.[0] ?? 0;
    const b = key[0]?.[1] ?? 0;
    const c = key[1]?.[0] ?? 0;
    const d = key[1]?.[1] ?? 0;
    return [mod(a * p0 + b * p1, 26), mod(c * p0 + d * p1, 26)];
}

function letter(value: number): string {
    return String.fromCharCode(65 + mod(value, 26));
}

function number(ch: string): number {
    return ch.charCodeAt(0) - 65;
}

/** Build the plaintext character entities for a frame. */
function makeCharacters(text: string, current: number): VisualEntity[] {
    return text.split("").map((ch, index) => {
        let state: EntityState = "idle";
        if (index < current) {
            state = "sorted";
        } else if (index >= current && index < current + 2) {
            state = "active";
        }
        return {
            id: `char-${index}`,
            type: "character" as const,
            label: ch,
            value: ch,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index },
        };
    });
}

/** Run the Hill cipher encryption generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HillInput | null) ?? {};
    const key = Array.isArray(task.key) && task.key.length === 2 && task.key.every((row) => row?.length === 2)
        ? task.key
        : [[3, 3], [2, 5]];
    const raw = typeof task.message === "string" ? task.message.toUpperCase().replace(/[^A-Z]/g, "") : "ACT";
    const padded = raw.length > 0 ? (raw.length % 2 === 1 ? `${raw}X` : raw) : "XX";
    const inv = inverseKey(key);

    let cipher = "";
    let decrypted = "";
    const blocks: number[] = [];
    let step = 0;
    let current = 0;

    const frame = (description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeCharacters(padded, current),
        edges: [],
        description,
        codeLineNumber,
        layout: "text",
        meta: {
            key: key.flat(),
            ciphertext: cipher,
            decrypted,
            blocks: [...blocks],
            invertible: inv !== null,
        },
    });

    yield frame(`Hill cipher on "${padded}" with key [${key.flat().join(", ")}] modulo 26.`, 0);

    if (inv === null) {
        yield frame("The key matrix is not invertible modulo 26, so decryption is undefined.", 5);
        return;
    }

    const pairs: number[][] = [];
    for (let i = 0; i < padded.length; i += 2) {
        const p0 = number(padded[i] ?? "A");
        const p1 = number(padded[i + 1] ?? "A");
        const [c0, c1] = encryptPair(key, p0, p1);
        pairs.push([c0, c1]);
        cipher += letter(c0) + letter(c1);
        blocks.push(c0, c1);
        current = i;
        yield frame(
            `Block ${i / 2}: [${p0}, ${p1}] times the key gives [${c0}, ${c1}], or "${letter(c0)}${letter(c1)}".`,
            2,
        );
    }

    for (const [c0, c1] of pairs) {
        const [p0, p1] = encryptPair(inv, c0 ?? 0, c1 ?? 0);
        decrypted += letter(p0) + letter(p1);
    }
    current = padded.length;
    yield frame(`Ciphertext "${cipher}" decrypts back to "${decrypted}".`, 5);
}

/** The Hill cipher module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "The Hill cipher hides letter frequencies by mixing pairs of letters together. A pair becomes a numeric vector, a matrix multiplication modulo 26 scrambles the two values, and the result becomes a new letter pair. Repeating this over every block makes a single letter's contribution depend on its neighbor.",
        invariants: [
            "Each block is two letters, padded with X when the message length is odd.",
            "Encryption is the key matrix times the block vector modulo 26.",
            "The key must have a determinant coprime to 26 so an inverse matrix exists.",
        ],
        correctness:
            "If K is the key matrix and K inverse is its modular inverse, then K inverse times (K times p) equals p because the matrix product is the identity modulo 26. The module computes the inverse using the adjugate divided by the determinant modulo 26, and a test checks that decryption recovers the padded plaintext and that encryption matches an independent matrix calculation.",
        complexityRationale:
            "Each two-letter block costs a fixed eight multiplications and additions, so encryption is O(m) for m letters. The displayed characters and ciphertext also use O(m) space.",
        uses: [
            "A classroom example of polygraphic substitution and linear algebra",
            "Understanding why matrix invertibility matters in cryptography",
            "A historical cipher broken by known-plaintext linear algebra",
        ],
        references: [
            "Hill, Concerning Certain Linear Transformation Apparatus of Cryptography, 1929",
            "Singh, The Code Book, 1999",
        ],
        workedExample:
            "With key [[3, 3], [2, 5]] and message ACT, pad to ACTX. The pair AC is [0, 2], and the key gives [6, 10], or GK. The pair TX is [19, 23], giving [22, 23], or WX. The ciphertext is GKWX, and multiplying by the inverse key [[15, 17], [20, 9]] recovers ACTX.",
    },
    id: "hill-cipher",
    name: "Hill Cipher (2 by 2)",
    category: "cryptography-security",
    complexity: { time: "O(m)", space: "O(m)" },
    defaultInput: { key: [[3, 3], [2, 5]], message: "ACT" },
    visualType: "text",
    run,
    pseudocode: [
        "map letters to numbers from zero to twenty-five",
        "pad the message to an even length with X",
        "for each two-letter block form a column vector",
        "multiply the key matrix by the vector modulo twenty-six",
        "map the resulting numbers back to letters",
        "decrypt by multiplying with the inverse key matrix",
        "done: report the ciphertext and recovered plaintext",
    ],
};

export default module;

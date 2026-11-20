/**
 * mceliece-encryption.ts - Toy McEliece-Style Code-Based Encryption
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a small, fully deterministic model of McEliece public-key encryption.
 * The private key is a binary [7,4,3] Hamming code (a generator matrix G and a
 * parity-check matrix H). The public key is G with its columns permuted by a
 * secret permutation. To encrypt a 4-bit message, compute c = m*G_pub (mod 2)
 * and flip at most one bit. The owner of the private permutation computes the
 * syndrome c*H_priv, which identifies the flipped bit because Hamming-code
 * columns are distinct and nonzero; after removing it the message is read off
 * from the permuted identity columns.
 *
 * The parameters are tiny so every step is replayable and exact. This is NOT a
 * secure instantiation: real McEliece uses large Goppa codes and can correct
 * many errors, with a carefully structured private decoder.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) for the toy matrices (n = 7)
 *   Space: O(n^2) for the stored generator and parity-check matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A key/value grid shows the message, public key, ciphertext, syndrome,
 *     recovered error position, and decoded message.
 *   - The row being computed is highlighted in yellow; finished rows are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const N = 7;
const K = 4;

/** Parity-check matrix of the [7,4,3] Hamming code; columns 1..7 are distinct nonzero. */
const H: number[][] = [
    [0, 1, 1, 1, 1, 0, 0],
    [1, 0, 1, 1, 0, 1, 0],
    [1, 1, 0, 1, 0, 0, 1],
];

/** Systematic generator matrix G = [I_4 | A^T], satisfying G * H^T = 0 mod 2. */
const G: number[][] = [
    [1, 0, 0, 0, 0, 1, 1],
    [0, 1, 0, 0, 1, 0, 1],
    [0, 0, 1, 0, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1],
];

const DEFAULT_PERM = [2, 5, 0, 6, 1, 3, 4];
const ROWS = [
    "message m",
    "public G row0",
    "error e",
    "ciphertext c",
    "syndrome s",
    "error found",
    "recovered m",
    "agreed",
] as const;

/** Bit string, most significant message bit first. */
function bits(value: number, count: number): number[] {
    return Array.from({ length: count }, (_, i) => (value >> (count - 1 - i)) & 1);
}

export interface McElieceData {
    message: number;
    errorPosition: number;
    perm: number[];
    invPerm: number[];
    messageBits: number[];
    gPub: number[][];
    hPriv: number[][];
    error: number[];
    ciphertext: number[];
    syndrome: number[];
    errorFound: number;
    recovered: number;
}

/**
 * Full toy McEliece round trip. The permutation is part of the private key and
 * scrambles the code columns; `errorPosition = -1` means no error was added.
 */
export function buildMcEliece(message: number, errorPosition: number, perm: number[]): McElieceData {
    const messageBits = bits(message, K);
    const gPub = G.map((row) => perm.map((column) => row[column] ?? 0));
    const hPriv = H.map((row) => perm.map((column) => row[column] ?? 0));
    const error = Array<number>(N).fill(0);
    if (errorPosition >= 0 && errorPosition < N) {
        error[errorPosition] = 1;
    }
    const ciphertext = Array<number>(N).fill(0);
    for (let j = 0; j < N; j += 1) {
        let sum = error[j] ?? 0;
        for (let i = 0; i < K; i += 1) {
            sum += (messageBits[i] ?? 0) * (gPub[i]?.[j] ?? 0);
        }
        ciphertext[j] = sum % 2;
    }
    const syndrome = hPriv.map((row) => row.reduce((sum, entry, j) => sum + entry * (ciphertext[j] ?? 0), 0) % 2);
    let errorFound = -1;
    for (let p = 0; p < N; p += 1) {
        const column = hPriv.map((row) => row[p] ?? 0);
        if (column.every((entry, k) => entry === syndrome[k])) {
            errorFound = p;
            break;
        }
    }
    const invPerm = Array<number>(N).fill(0);
    perm.forEach((column, position) => {
        invPerm[column] = position;
    });
    const cleaned = ciphertext.map((bit, j) => bit ^ (j === errorFound ? 1 : 0));
    const recoveredBits = Array<number>(K).fill(0);
    for (let i = 0; i < K; i += 1) {
        recoveredBits[i] = cleaned[invPerm[i] ?? 0] ?? 0;
    }
    const recovered = recoveredBits.reduce((value, bit) => value * 2 + bit, 0);
    return {
        message,
        errorPosition,
        perm,
        invPerm,
        messageBits,
        gPub,
        hPriv,
        error,
        ciphertext,
        syndrome,
        errorFound,
        recovered,
    };
}

/** Build the key/value grid cells. */
function makeCells(values: Array<string | null>, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < ROWS.length; row += 1) {
        const value = values[row];
        const state: EntityState = row === current ? "comparing" : value !== null ? "sorted" : "idle";
        entities.push({
            id: `cell-${row}-0`,
            type: "cell",
            label: ROWS[row] ?? "",
            value: ROWS[row] ?? "",
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col: 0 },
        });
        entities.push({
            id: `cell-${row}-1`,
            type: "cell",
            label: value ?? "?",
            value: value ?? "",
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col: 1 },
        });
    }
    return entities;
}

/** The toy McEliece generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number; errorPosition?: number; perm?: number[] } | null) ?? {};
    const message = typeof task.message === "number" ? ((Math.floor(task.message) % 16) + 16) % 16 : 11;
    const errorPosition = typeof task.errorPosition === "number" ? Math.floor(task.errorPosition) : 3;
    const perm = Array.isArray(task.perm) && task.perm.length === N ? [...task.perm] : [...DEFAULT_PERM];
    const data = buildMcEliece(message, errorPosition, perm);

    const values: Array<string | null> = Array(ROWS.length).fill(null);
    let step = 0;
    const emit = (current: number, line: number, description: string): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(values, current),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: ROWS.length,
            cols: 2,
            n: N,
            k: K,
            perm: [...perm],
            ...(values[0] !== null ? { message } : {}),
            ...(values[3] !== null ? { ciphertext: [...data.ciphertext] } : {}),
            ...(values[4] !== null ? { syndrome: [...data.syndrome], errorFound: data.errorFound } : {}),
            ...(values[6] !== null ? { recovered: data.recovered, agreed: data.recovered === message } : {}),
        },
    });

    yield emit(-1, 0, `Toy McEliece setup: [7,4,3] Hamming code, one-bit error, secret column permutation (not secure).`);
    values[0] = data.messageBits.join("");
    values[1] = data.gPub[0]?.join("") ?? "";
    yield emit(0, 1, `Public key is the permuted generator; its first row is ${values[1]}. The permutation stays private.`);
    values[2] = data.error.join("");
    values[3] = data.ciphertext.join("");
    yield emit(3, 3, `Encrypt: c = m*G_pub plus a one-bit error = ${values[3]}.`);
    values[4] = data.syndrome.join("");
    values[5] = String(data.errorFound);
    yield emit(5, 5, `Syndrome c*H_priv = ${values[4]} identifies the flipped bit at position ${data.errorFound}.`);
    values[6] = String(data.recovered);
    values[7] = data.recovered === message ? "yes" : "no";
    yield emit(7, 7, `Remove the error and read the message: ${data.recovered} (agreement: ${data.recovered === message}).`);
}

/** The toy McEliece encryption module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Hide a structured error-correcting code behind a scrambled public key. Anyone can use the public matrix to add a small error to a message, but only the owner knows the permutation that turns the received word back into a codeword with a decodable syndrome. The private decoder corrects the error and reads the original bits.",
        invariants: [
            "The public generator and private parity check satisfy G_pub times H_priv transposed equals zero modulo two.",
            "The ciphertext equals the encoded message plus an error of weight at most one.",
            "Because Hamming columns are distinct and nonzero, the syndrome uniquely identifies a single flipped bit.",
        ],
        correctness:
            "The syndrome is c times H_priv transposed, which equals e times H_priv transposed because the encoded message is in the null space. With a single error this is exactly one column of H_priv, and all columns are distinct, so the flipped position is recovered uniquely. Removing it leaves m times G_pub; the four columns that were the identity in G now form a permuted identity, so reading those positions inverts the permutation and returns m exactly.",
        complexityRationale:
            "With the tiny seven-by-four matrices, encoding and syndrome decoding take a constant number of bit operations, O(n squared) in the code length n. The stored public and private matrices use O(n squared) space. Production McEliece uses codes of length in the thousands, so real parameters are far larger than this teaching model.",
        uses: [
            "Post-quantum public-key encryption based on coding theory",
            "The Classic McEliece candidate in post-quantum standardization",
            "A teaching model for syndrome decoding and public-key hiding",
        ],
        references: [
            "McEliece, A Public-Key Cryptosystem Based on Algebraic Coding Theory, 1978",
            "MacWilliams and Sloane, The Theory of Error-Correcting Codes, Chapters 1 and 9",
        ],
        workedExample:
            "With message 1011, error at position 3, and perm [2,5,0,6,1,3,4], encryption forms c = m times the permuted generator with bit 3 flipped. The receiver computes the syndrome against the permuted parity check, which equals column 3 of that matrix, flips bit 3 back, and reads the four identity-derived positions to recover 1011.",
    },
    id: "mceliece-encryption",
    name: "McEliece Encryption (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { message: 11, errorPosition: 3, perm: DEFAULT_PERM },
    visualType: "grid",
    run,
    pseudocode: [
        "choose the private Hamming generator G and parity check H",
        "scramble the code columns with a secret permutation",
        "publish the permuted generator as the public key",
        "encode the message as c = m times the public generator modulo two",
        "flip at most one bit of c to add the error",
        "compute the syndrome c times the private parity check",
        "match the syndrome to a column to locate the flipped bit",
        "remove the error and read the message from identity columns",
        "done: report the decoded message and agreement",
    ],
};

export default module;

/**
 * bfv-homomorphic-encryption.ts - Toy LWE Homomorphic Encryption
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BFV is a homomorphic encryption scheme: it lets a server compute on encrypted
 * integers and have the client decrypt the result of the computation. This
 * module implements a small LWE-based teaching model that supports addition of
 * two ciphertexts and multiplication by a plaintext constant. A ciphertext is a
 * pair (c1, c2) chosen so that c2 minus secret times c1 equals message times a
 * scale plus small noise; decryption rounds away the noise. This toy is exact
 * for small messages but is not BFV, has no relinearization or bootstrapping,
 * and provides no security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) modular operations per encryption, decryption, or operation
 *   Space: O(1) for one ciphertext pair
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars reveal the decrypted values after encrypt, add, and scale.
 *   - The remaining bars are idle until their operation is shown.
 *   - Modulus, scale, and the ciphertext pairs are reported in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BfvInput {
    q?: number;
    delta?: number;
    a?: number;
    s?: number;
    x?: number;
    y?: number;
    c?: number;
}

type Ciphertext = [number, number];

function mod(value: number, m: number): number {
    return ((value % m) + m) % m;
}

/** Deterministic small randomness so the replay is reproducible. */
function randomness(message: number, nonce: number): [number, number, number] {
    return [
        mod(message * 7 + nonce * 13 + 5, 7) - 3,
        mod(message * 3 + nonce * 11 + 2, 5) - 2,
        mod(message * 5 + nonce * 3 + 4, 5) - 2,
    ];
}

function encrypt(
    message: number,
    nonce: number,
    params: { q: number; delta: number; a: number; b: number },
): Ciphertext {
    const [r, e1, e2] = randomness(message, nonce);
    const c1 = mod(params.a * r + e1, params.q);
    const c2 = mod(params.b * r + e2 + message * params.delta, params.q);
    return [c1, c2];
}

function decrypt(cipher: Ciphertext, s: number, q: number, delta: number): number {
    let value = mod(cipher[1] - s * cipher[0], q);
    if (value > q / 2) {
        value -= q;
    }
    return Math.round(value / delta);
}

/** Build the result bars for a frame. */
function makeBars(values: number[], revealed: number): VisualEntity[] {
    const labels = ["encrypt(x)", "encrypt(y)", "sum", "scaled"];
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (index < revealed) {
            state = "sorted";
        }
        return {
            id: `result-${index}`,
            type: "bar" as const,
            label: index < revealed ? `${labels[index]}=${value}` : `${labels[index]}=?`,
            value: index < revealed ? value : 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index },
        };
    });
}

/** Run the toy homomorphic operations generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BfvInput | null) ?? {};
    const q = typeof task.q === "number" && task.q > 1000 ? Math.floor(task.q) : 1048576;
    const delta = typeof task.delta === "number" && task.delta > 10 ? Math.floor(task.delta) : 1000;
    const a = typeof task.a === "number" ? mod(task.a, q) : 7919;
    const s = typeof task.s === "number" ? mod(task.s, q) : 3;
    const x = typeof task.x === "number" ? task.x : 7;
    const y = typeof task.y === "number" ? task.y : 3;
    const c = typeof task.c === "number" ? task.c : 4;
    const b = mod(a * s + 1, q);

    const cx = encrypt(x, 0, { q, delta, a, b });
    const cy = encrypt(y, 1, { q, delta, a, b });
    const sum: Ciphertext = [mod(cx[0] + cy[0], q), mod(cx[1] + cy[1], q)];
    const scaled: Ciphertext = [mod(cx[0] * c, q), mod(cx[1] * c, q)];
    const results = [
        decrypt(cx, s, q, delta),
        decrypt(cy, s, q, delta),
        decrypt(sum, s, q, delta),
        decrypt(scaled, s, q, delta),
    ];
    const cipherFlat = [...cx, ...cy, ...sum, ...scaled];
    let step = 0;
    let revealed = 0;

    const frame = (description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(results, revealed),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "array",
        meta: { q, delta, a, s, x, y, c, results: [...results], ciphertexts: cipherFlat },
    });

    yield frame(`Toy homomorphic encryption modulo ${q} with scale ${delta}.`, 0);
    revealed = 1;
    yield frame(`Encrypt x = ${x}; a fresh ciphertext decrypts to ${results[0]}.`, 1);
    revealed = 2;
    yield frame(`Encrypt y = ${y}; a fresh ciphertext decrypts to ${results[1]}.`, 1);
    revealed = 3;
    yield frame(`Add the ciphertexts; decryption reveals x + y = ${results[2]}.`, 2);
    revealed = 4;
    yield frame(`Scale the first ciphertext by ${c}; decryption reveals x*c = ${results[3]}.`, 3);
}

/** The BFV teaching-core module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Homomorphic encryption lets a computer add or scale encrypted numbers without learning them. In this toy, a ciphertext hides a message inside c2 minus secret times c1, with the message multiplied by a large scale and a little noise added. Adding ciphertexts adds their underlying messages, and scaling a ciphertext scales its message; rounding after decryption removes the small noise.",
        invariants: [
            "Decrypting a fresh ciphertext returns the hidden message.",
            "Adding two ciphertexts yields a ciphertext that decrypts to the sum of the messages.",
            "The noise stays far below half the scale so rounding recovers the exact integer.",
        ],
        correctness:
            "For encryption with public a and secret s, the key satisfies b = a s + e. Decryption computes c2 minus s times c1, which equals message times scale plus (e r + e2 minus s e1), a small noise term. Adding ciphertexts adds both message times scale terms and both noises, so decryption gives x + y; scaling by c gives x times c. Rounding divides by the scale and removes noise smaller than half the scale.",
        complexityRationale:
            "Encryption, decryption, addition, and plaintext scaling each use a constant number of modular operations, so O(1) time and O(1) space. BFV achieves the same operations on large vectors with polynomial arithmetic, which this scalar toy omits.",
        uses: [
            "Private computation on encrypted data in untrusted environments",
            "Secure aggregation of encrypted statistics",
            "A teaching model for additive and plaintext-multiplicative homomorphism",
        ],
        references: [
            "Brakerski, Fully Homomorphic Encryption without Modulus Switching, 2012",
            "Fan, Vercauteren, and Verbauwhede, Somewhat Practical Fully Homomorphic Encryption, 2012",
        ],
        workedExample:
            "With scale 1000 and small noise, encrypting x = 7 hides the value 7000 plus noise in the ciphertext. Encrypting y = 3 hides 3000. Adding the ciphertexts hides 10000 plus combined noise, and dividing by 1000 and rounding returns 10, the plaintext sum, without ever exposing 7 or 3.",
    },
    id: "bfv-homomorphic-encryption",
    name: "BFV (Toy Homomorphic Core)",
    category: "cryptography-security",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { q: 1048576, delta: 1000, a: 7919, s: 3, x: 7, y: 3, c: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a large modulus, a scale, and a secret s",
        "set the public value b equal to a times s plus small noise",
        "encrypt a message as c1 and c2 with small random noise",
        "decrypt by rounding c2 minus s times c1 divided by the scale",
        "add ciphertexts componentwise to add their messages",
        "scale a ciphertext componentwise to scale its message",
        "done: report the decrypted results of each operation",
    ],
};

export default module;

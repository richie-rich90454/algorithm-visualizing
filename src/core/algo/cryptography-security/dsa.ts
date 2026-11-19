/**
 * dsa.ts - Digital Signature Algorithm (Toy Parameters)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DSA signs a message with a secret exponent x and verifies it with the public
 * value y = g^x mod p. A fresh per-message exponent k produces r = (g^k mod p)
 * mod q and s = k^-1 (H(m) + x r) mod q. A verifier recomputes a value v from
 * r, s, the message hash, and y, and accepts only when v equals r. This module
 * uses tiny primes so every step can be shown; it is a teaching model, not a
 * secure implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log p) modular multiplications per sign or verify step
 *   Space: O(1) for the scalars plus O(m) visualized cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero holds messages and hashes; row one holds r and s per signature.
 *   - A verification shows its recomputed v next to the claimed r.
 *   - meta carries the public key and every signature's validity.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DsaInput {
    p?: number;
    q?: number;
    g?: number;
    x?: number;
    messages?: string[];
}

const DEFAULT_MESSAGES = ["hello", "world", "verify"];

/** Modular exponentiation by repeated squaring. */
function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Modular inverse via the extended Euclidean algorithm. */
function modInverse(value: number, modulus: number): number {
    let [oldR, r] = [((value % modulus) + modulus) % modulus, modulus];
    let [oldS, s] = [1, 0];
    while (r !== 0) {
        const quotient = Math.floor(oldR / r);
        [oldR, r] = [r, oldR - quotient * r];
        [oldS, s] = [s, oldS - quotient * s];
    }
    return ((oldS % modulus) + modulus) % modulus;
}

const hashMessage = (message: string, q: number): number => {
    let h = 0;
    for (let i = 0; i < message.length; i += 1) h = (h + (message.charCodeAt(i) as number)) % q;
    return h;
};

function cell(id: string, row: number, col: number, label: string, value: string | number, state: EntityState): VisualEntity {
    return { id, type: "cell", label, value, state, x: 0, y: 0, width: 0, height: 0, metadata: { row, col } };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DsaInput | null) ?? {};
    const p = Math.max(3, Math.floor(task.p ?? 23));
    const q = Math.max(3, Math.floor(task.q ?? 11));
    const g = Math.max(2, Math.floor(task.g ?? 2)) % p;
    const x = Math.max(1, Math.floor(task.x ?? 7)) % q;
    const messages = Array.isArray(task.messages) && task.messages.length > 0 ? task.messages : DEFAULT_MESSAGES;
    const y = modPow(g, x, p);
    let step = 0;
    const cols = Math.max(messages.length, 3);
    const emit = (entities: VisualEntity[], description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step++,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: 3, cols, p, q, g, y, ...meta },
    });

    yield emit(
        [cell("pub", 0, 0, `y=${y}`, `y=${y}`, "active"), cell("params", 1, 0, `p=${p} q=${q} g=${g}`, `p=${p} q=${q} g=${g}`, "idle")],
        `Toy DSA setup: public key y = g^x mod p = ${y}; the secret x stays hidden.`,
        0,
        { stage: "setup", publicKey: y },
    );

    const signatures: string[] = [];
    const validities: boolean[] = [];
    for (let i = 0; i < messages.length; i += 1) {
        const message = messages[i] as string;
        const h = hashMessage(message, q);
        let k = (h + i + 1) % q;
        if (k === 0) k = 1;
        let r = modPow(g, k, p) % q;
        let s = (modInverse(k, q) * (h + x * r)) % q;
        let guard = 0;
        while ((r === 0 || s === 0) && guard < q) {
            k = (k % (q - 1)) + 1;
            r = modPow(g, k, p) % q;
            s = (modInverse(k, q) * (h + x * r)) % q;
            guard += 1;
        }

        yield emit(
            [cell(`m-${i}`, 0, i, message, message, "active"), cell(`h-${i}`, 1, i, `H=${h}`, h, "comparing")],
            `Message "${message}" hashes to ${h}; choose nonce k = ${k}.`,
            1,
            { stage: "hash", message, hash: h, k },
        );
        yield emit(
            [cell(`r-${i}`, 0, i, `r=${r}`, r, "active"), cell(`s-${i}`, 1, i, `s=${s}`, s, "sorted")],
            `Signature: r = (g^k mod p) mod q = ${r}; s = k^-1 (H + x r) mod q = ${s}.`,
            2,
            { stage: "sign", message, r, s },
        );

        const w = modInverse(s, q);
        const u1 = (h * w) % q;
        const u2 = (r * w) % q;
        const v = (modPow(g, u1, p) * modPow(y, u2, p)) % p % q;
        const valid = v === r;
        validities.push(valid);
        signatures.push(`${message}:${h}:${r}:${s}:${valid ? "valid" : "invalid"}`);
        yield emit(
            [cell(`v-${i}`, 0, i, `v=${v}`, v, valid ? "sorted" : "error"), cell(`expect-${i}`, 1, i, `r=${r}`, r, "visited")],
            `Verify ${message}: w=${w}, u1=${u1}, u2=${u2}, v=${v}; ${valid ? "v equals r, accepted" : "v differs from r, rejected"}.`,
            3,
            { stage: "verify", message, v, r, valid },
        );
    }

    const allValid = validities.every(Boolean);
    yield emit(
        signatures.map((entry, i) => cell(`sig-${i}`, 0, i, entry.split(":")[0] as string, entry, allValid ? "sorted" : "error")),
        `Done: ${signatures.length} signature(s) checked; ${allValid ? "all accepted" : "at least one rejected"}.`,
        4,
        { stage: "done", signatures, allValid, publicKey: y },
    );
}

/** The DSA toy module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A digital signature proves that a message came from the key holder without revealing the secret key. DSA binds the message hash to a secret exponent through two numbers r and s. A fresh random nonce makes each signature different, while the public key lets anyone check the algebraic relation that ties r, s, and the hash together.",
        invariants: [
            "The public key satisfies y = g^x mod p with the secret x.",
            "A valid signature has r = (g^k mod p) mod q for its nonce k.",
            "Verification accepts exactly when the recomputed v equals r.",
        ],
        correctness:
            "For an honest signer, u1 = H*w and u2 = r*w with w = s^-1, so g^u1 * y^u2 = g^(H*w) * (g^x)^(r*w) = g^((H + x*r)*w) = g^k mod p because s = k^-1 (H + x r). Reducing modulo q gives r, so v equals r and the signature verifies. A forged hash or altered r or s breaks this equality and is rejected.",
        complexityRationale:
            "Signing and verifying each perform a constant number of modular exponentiations, each costing O(log p) multiplications by repeated squaring. The visualization holds one cell per message, so space is O(m) for display and O(1) for the arithmetic.",
        uses: [
            "Authenticating software updates and documents",
            "Transaction signing in distributed ledgers",
            "A teaching model for discrete-logarithm signatures",
        ],
        references: [
            "NIST FIPS 186-5, Digital Signature Standard, 2023",
            "ElGamal, A Public Key Cryptosystem and a Signature Scheme Based on Discrete Logarithms, 1985",
        ],
        workedExample:
            "With p=23, q=11, g=2 and secret x=7, the public key is y = 2^7 mod 23 = 13. For a message whose hash is 4 and nonce k=3, r = 2^3 mod 23 mod 11 = 8 and s = 3^-1 (4 + 7*8) mod 11. A verifier recomputes v from y=13 and accepts only if v returns to 8.",
    },
    id: "dsa",
    name: "DSA Digital Signature (Toy Parameters)",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { p: 23, q: 11, g: 2, x: 7, messages: DEFAULT_MESSAGES },
    visualType: "grid",
    run,
    pseudocode: [
        "choose primes p and q with q dividing p minus one",
        "set public key y to g to the x mod p",
        "hash the message to an exponent below q",
        "pick a nonce k and compute r from g to the k",
        "compute s as k inverse times hash plus x times r",
        "verify by recomputing v from r s and y",
        "accept the signature only when v equals r",
        "done: report every signature verdict",
    ],
};

export default module;

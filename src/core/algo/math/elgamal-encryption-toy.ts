import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function C(
    r: number,
    c: number,
    label: string,
    value: number,
    state: EntityState = "idle",
): VisualEntity {
    return {
        id: `cell-${r}-${c}`,
        type: "cell" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: r, col: c },
    };
}
/**
 * elgamal-encryption-toy – Toy ElGamal Encryption.
 * Tiny prime 11 keeps every power checkable by hand.
 * Default m=5 -> (c1,c2) = (5,9), decrypts to 5. Time O(log p).
 */
function modPow(b: number, e: number, m: number): number {
    let r = 1;
    let x = ((b % m) + m) % m;
    let k = e;
    while (k > 0) {
        if (k % 2 === 1) r = (r * x) % m;
        x = (x * x) % m;
        k = Math.trunc(k / 2);
    }
    return r;
}
function modInv(a: number, p: number): number {
    const v = ((a % p) + p) % p;
    for (let x = 1; x < p; x += 1) if ((v * x) % p === 1) return x;
    return 0;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t =
        (input as { p?: number; g?: number; x?: number; m?: number; k?: number } | null) ?? {};
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 11;
    const g = typeof t.g === "number" ? Math.trunc(t.g) : 2;
    const x = typeof t.x === "number" ? Math.trunc(t.x) : 3;
    const m = typeof t.m === "number" ? Math.trunc(t.m) : 5;
    const k = typeof t.k === "number" ? Math.trunc(t.k) : 4;
    let step = 0;
    if (!(p >= 3) || !(m >= 1) || m >= p) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs prime p, 1 <= m < p).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const h = modPow(g, x, p);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `p=${p}`, p, "idle"), C(0, 1, `m=${m}`, m, "idle")],
        edges: [],
        description: `ElGamal mod ${p}: encrypt message ${m}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `g=${g}`, g, "idle"),
            C(0, 1, `x=${x}`, x, "idle"),
            C(0, 2, `h=${h}`, h, "highlight"),
        ],
        edges: [],
        description: `Keygen: h = ${g}^${x} = ${h} mod ${p}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { h },
    };
    step += 1;
    const c1 = modPow(g, k, p);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `c1=${c1}`, c1, "comparing")],
        edges: [],
        description: `c1 = ${g}^${k} = ${c1} mod ${p}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { c1 },
    };
    step += 1;
    const s = modPow(h, k, p);
    const c2 = (m * s) % p;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `s=${s}`, s, "comparing"), C(0, 1, `c2=${c2}`, c2, "highlight")],
        edges: [],
        description: `Shared ${h}^${k} = ${s}; c2 = ${m}x${s} = ${c2}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { c2 },
    };
    step += 1;
    const s2 = modPow(c1, x, p);
    const dec = (c2 * modInv(s2, p)) % p;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `m=${dec}`, dec, dec === m ? "sorted" : "swapped")],
        edges: [],
        description: `Decrypt ${c2} / ${c1}^${x}=${s2} = ${dec}${dec === m ? " – matches" : " – MISMATCH"}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { dec },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "ElGamal encryption hides a message using the difficulty of the discrete logarithm. The receiver publishes a generator g and public key h = g^x, keeping x secret. The sender masks the message with h^k using a random k and sends a companion value g^k so the receiver can reconstruct the same mask without learning k.",
        "invariants": [
            "The public key h equals g^x mod p.",
            "The ciphertext pair is c1 = g^k and c2 = m*h^k mod p.",
            "Decryption multiplies c2 by the inverse of c1^x to recover m."
        ],
        "correctness": "Since c1^x = (g^k)^x = h^k mod p, the receiver computes (c1^x)^-1 and c2 times that inverse equals m*h^k*(h^k)^-1 = m. The secret exponent x is needed to form the inverse, so an observer cannot strip the mask without solving a discrete log.",
        "complexityRationale": "Encryption and decryption each use a handful of modular exponentiations costing O(log p) time with binary exponentiation. Only a few residues are stored, so space is O(1).",
        "uses": [
            "Public-key encryption built on discrete logarithms",
            "Hybrid encryption key encapsulation",
            "Teaching the structure of asymmetric cryptosystems"
        ],
        "references": [
            "ElGamal, A public key cryptosystem and a signature scheme (1985)",
            "Menezes et al., Handbook of Applied Cryptography, Chapter 8"
        ],
        "workedExample": "With p = 11, g = 2, secret x = 3, public h = 8, message m = 5, and random k = 4: c1 = 2^4 = 5, c2 = 5*8^4 mod 11 = 3. The receiver computes (5^3)^-1 = 9^-1 = 5 and 3*5 mod 11 = 5, recovering the message."
    },
    id: "elgamal-encryption-toy",
    name: "ElGamal Encryption (Toy)",
    category: "math",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { p: 11, g: 2, x: 3, m: 5, k: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "publish p, g and the public key h = g^x mod p",
        "mask with c1 = g^k mod p",
        "hide the message: c2 = m·h^k mod p",
        "recover m = c2·(c1^x)⁻¹ mod p",
        "done: decrypted text matches the message",
    ],
};
export default module;

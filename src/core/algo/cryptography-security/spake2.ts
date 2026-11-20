/**
 * spake2.ts - SPAKE2 Password Authenticated Key Exchange (Toy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SPAKE2 lets two parties who share only a password agree on a strong session
 * key over an insecure channel. Each party masks its Diffie-Hellman share with
 * a fixed public group element raised to a value derived from the password.
 * After exchanging masked shares, each removes the other party's password mask
 * and computes the same shared secret, while an eavesdropper who guesses wrong
 * derives a different secret. This module uses a small prime field and a toy
 * hash, so it is a teaching model and makes no security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(log p) modular multiplications per exponentiation
 *   Space: O(1) field elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the two masked shares and the secret each party derives.
 *   - The final frame highlights whether the two secrets match.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 1000003;
const G = 2;

/** Exact modular exponentiation by repeated squaring. */
export function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let e = Math.floor(exponent);
    while (e > 0) {
        if (e % 2 === 1) {
            result = (result * b) % modulus;
        }
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** A deterministic toy hash used to map a password to a group exponent. */
export function passwordScalar(password: string): number {
    let h = 2166136261;
    for (let i = 0; i < password.length; i += 1) {
        h ^= password.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h % (P - 1);
}

/** Fixed public mask elements, chosen as powers of the generator. */
export const MASK_M = powMod(G, 123456, P);
export const MASK_N = powMod(G, 789012, P);

/** Party A's masked share: g to x times M to the password scalar. */
export function shareA(password: string, x: number): number {
    const w = passwordScalar(password);
    return (powMod(G, x, P) * powMod(MASK_M, w, P)) % P;
}

/** Party B's masked share: g to y times N to the password scalar. */
export function shareB(password: string, y: number): number {
    const w = passwordScalar(password);
    return (powMod(G, y, P) * powMod(MASK_N, w, P)) % P;
}

/** Party A removes B's mask and raises the result to its private x. */
export function secretA(password: string, x: number, receivedFromB: number): number {
    const w = passwordScalar(password);
    const nw = powMod(MASK_N, w, P);
    const base = (receivedFromB * powMod(nw, P - 2, P)) % P;
    return powMod(base, x, P);
}

/** Party B removes A's mask and raises the result to its private y. */
export function secretB(password: string, y: number, receivedFromA: number): number {
    const w = passwordScalar(password);
    const mw = powMod(MASK_M, w, P);
    const base = (receivedFromA * powMod(mw, P - 2, P)) % P;
    return powMod(base, y, P);
}

function makeBars(values: number[], active: number): VisualEntity[] {
    const roles = ["A masked share X", "B masked share Y", "A secret", "B secret"];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: (index === active ? "active" : index >= 2 ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { role: roles[index] ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { password?: string; otherPassword?: string; x?: number; y?: number } | null) ?? {};
    const password = typeof task.password === "string" ? task.password : "shared secret";
    const otherPassword = typeof task.otherPassword === "string" ? task.otherPassword : password;
    const x = typeof task.x === "number" ? Math.max(1, Math.floor(task.x)) : 314;
    const y = typeof task.y === "number" ? Math.max(1, Math.floor(task.y)) : 271;
    const X = shareA(password, x);
    const Y = shareB(otherPassword, y);
    const keyA = secretA(password, x, Y);
    const keyB = secretB(otherPassword, y, X);
    const matched = keyA === keyB;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([X, 0, 0, 0], 0),
        edges: [],
        description: `SPAKE2 toy exchange over the field of size ${P}; both parties start from a shared password.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { modulus: P, x, y, matched: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([X, Y, 0, 0], 1),
        edges: [],
        description: `A sends masked share ${X}; B sends masked share ${Y}, each hiding a Diffie-Hellman value behind a password-derived mask.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { X, Y, matched: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([X, Y, keyA, 0], 2),
        edges: [],
        description: `A removes B's password mask and raises to its private value, deriving ${keyA}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { X, Y, keyA, matched: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([X, Y, keyA, keyB], 3),
        edges: [],
        description: `B removes A's password mask and raises to its private value, deriving ${keyB}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { X, Y, keyA, keyB, matched },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([X, Y, keyA, keyB], 3),
        edges: [],
        description: matched
            ? `Both derived the same session key; a wrong password guess would diverge. Toy field and hash, not secure.`
            : `The secrets differ, so the passwords do not match.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { X, Y, keyA, keyB, matched, modulus: P },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SPAKE2 is a password-authenticated key exchange that hides a normal Diffie-Hellman handshake behind password-derived masks. Each side multiplies its public share by a fixed group element raised to a value computed from the password. When both passwords match, the extra masks cancel and both sides arrive at the same secret. A passive attacker who guesses incorrectly ends up with a different secret and cannot tell a correct guess from an incorrect one without an extra confirmation step.",
        invariants: [
            "Each public share is a generator power multiplied by a password-derived mask element.",
            "Matching passwords make the two masks cancel so both parties compute the same group element.",
            "Different passwords produce different derived secrets with overwhelming probability in a real group.",
        ],
        correctness:
            "Party A computes (g to y times N to w) divided by N to w, all raised to x, which is g to x y. Party B computes (g to x times M to w) divided by M to w, all raised to y, also g to x y. The password-dependent masks cancel exactly when both use the same password scalar, so the secrets agree. Tests confirm agreement for matching passwords, divergence for differing passwords, and that the public shares are not equal to the unmasked Diffie-Hellman values. The small prime and toy hash make this a teaching model only.",
        complexityRationale:
            "Each side performs a constant number of modular exponentiations, each costing O(log p) multiplications. Only a few field elements are kept, so space is constant.",
        uses: [
            "Pairing devices with a short PIN in Bluetooth and smart-home setups",
            "Password-based secure channel establishment without a server-side password database",
            "Instant messaging pairing protocols such as those standardized for SPAKE2 in TLS",
        ],
        references: [
            "Abdalla and Pointcheval, Simple Password-Based Encrypted Key Exchange Protocols, 2005",
            "RFC 9382, SPAKE2 Symmetric Password-Authenticated Key Exchange",
        ],
        workedExample:
            "With password shared secret, A picks private x and sends g to x times M to the password scalar. B picks private y and sends g to y times N to the password scalar. A divides B's share by N to the password scalar and raises to x; B divides A's share by M to the password scalar and raises to y. Both obtain g to x y. If B used a different password, the division would not cancel and the secrets would differ.",
    },
    id: "spake2",
    name: "SPAKE2 (Toy Field)",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { password: "shared secret", otherPassword: "shared secret", x: 314, y: 271 },
    visualType: "array",
    run,
    pseudocode: [
        "fix a prime field, generator, and two public mask elements",
        "map each password to a scalar with a hash",
        "A sends generator to x times mask M to the password scalar",
        "B sends generator to y times mask N to the password scalar",
        "A removes B's mask and raises to x",
        "B removes A's mask and raises to y",
        "done: report whether the two session secrets match",
    ],
};

export default module;

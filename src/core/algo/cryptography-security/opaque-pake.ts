/**
 * opaque-pake.ts - OPAQUE OPRF Core (Blind, Evaluate, Unblind)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * OPAQUE is a strong augmented password-authenticated key exchange. Its central
 * idea is an oblivious pseudorandom function: the client blinds a password, the
 * server evaluates its secret key on the blinded value, and the client removes
 * the blinding to obtain an output that depends on both the password and the
 * server key. This module implements exactly that blind-evaluate-unblind core
 * with small integers modulo a prime, so the algebra is checkable. It is a
 * teaching model, not the full OPAQUE protocol and not a secure PAKE.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log exponent) for each modular exponentiation
 *   Space: O(1) integer values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars reveal the password hash, blinded value, server evaluation, blind
 *     inverse, unblinded output, and the direct server-side comparison value.
 *   - The final frame reports whether unblinding matched direct evaluation.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface OpaqueInput {
    p?: number;
    k?: number;
    password?: string;
    r?: number;
}

function mod(value: number, m: number): number {
    return ((value % m) + m) % m;
}

/** Fast modular exponentiation. */
function modPow(base: number, exponent: number, m: number): number {
    let result = 1;
    let b = mod(base, m);
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) {
            result = mod(result * b, m);
        }
        b = mod(b * b, m);
        e = Math.floor(e / 2);
    }
    return result;
}

/** Inverse of r modulo m, or minus one when it does not exist. */
function inverse(value: number, m: number): number {
    for (let x = 1; x < m; x += 1) {
        if (mod(value * x, m) === 1) {
            return x;
        }
    }
    return -1;
}

/** Deterministic small password hash into the multiplicative group. */
function passwordHash(password: string, p: number): number {
    let sum = 0;
    for (let i = 0; i < password.length; i += 1) {
        sum += password.charCodeAt(i);
    }
    return mod(sum, p - 1) + 1;
}

/** Build the reveal bars for one frame. */
function makeBars(values: Array<{ label: string; value: number }>, revealed: number): VisualEntity[] {
    return values.map((item, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: index < revealed ? `${item.label}=${item.value}` : `${item.label}=?`,
        value: index < revealed ? item.value : 0,
        state: index < revealed ? ("sorted" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: item.label },
    }));
}

/** Run the toy OPRF blind-evaluate-unblind flow. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as OpaqueInput | null) ?? {};
    const p = typeof task.p === "number" && task.p > 3 ? Math.floor(task.p) : 101;
    const k = typeof task.k === "number" ? mod(task.k, p - 1) : 13;
    const password = typeof task.password === "string" ? task.password : "hunter2";
    const r = typeof task.r === "number" && task.r > 1 ? Math.floor(task.r) : 7;

    const h = passwordHash(password, p);
    const alpha = modPow(h, r, p);
    const beta = modPow(alpha, k, p);
    const rInv = inverse(mod(r, p - 1), p - 1);
    const unblinded = rInv < 0 ? -1 : modPow(beta, rInv, p);
    const direct = modPow(h, k, p);
    const match = unblinded >= 0 && unblinded === direct;

    const items = [
        { label: "h", value: h },
        { label: "alpha", value: alpha },
        { label: "beta", value: beta },
        { label: "rInv", value: Math.max(0, rInv) },
        { label: "unblind", value: Math.max(0, unblinded) },
        { label: "direct", value: direct },
    ];

    let step = 0;
    const frame = (revealed: number, description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(items, revealed),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "array",
        meta: {
            p,
            k,
            r,
            password,
            h,
            alpha,
            beta,
            unblinded: Math.max(0, unblinded),
            direct,
            match,
        },
    });

    yield frame(0, `OPRF core modulo ${p}: blind a password, let the server evaluate, then unblind.`, 0);
    yield frame(1, `Hash the password to h = ${h} in the group modulo ${p}.`, 1);
    yield frame(2, `Client blinds with r = ${r}, sending alpha = h^r mod p = ${alpha}.`, 2);
    yield frame(3, `Server evaluates with secret k, returning beta = alpha^k mod p = ${beta}.`, 3);
    yield frame(5, `Client unblinds with r inverse ${rInv}, obtaining ${unblinded}.`, 4);
    yield frame(6, `Direct evaluation h^k mod p = ${direct}; match = ${match}.`, 5);
}

/** The OPAQUE teaching-core module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A password should never reach the server in the clear. The client raises a password-derived value to a random blind and sends the blinded result; the server applies its secret exponent and sends the answer back. Removing the blind leaves a value that only a client with the correct password can compute, while the server never learns that password.",
        invariants: [
            "The blind r must be invertible modulo the group order p minus one.",
            "The server only ever sees the blinded value alpha, never the password hash h.",
            "Unblinding beta with r inverse yields h to the power k modulo p.",
        ],
        correctness:
            "By Fermat's little theorem exponents are taken modulo p minus one. Since r times r inverse is one modulo p minus one, beta to the power r inverse equals h to the power (r k) times r inverse, which simplifies to h to the power k, the same value the server would compute directly from h. A test checks this identity and that a wrong password yields a different output.",
        complexityRationale:
            "Each modular exponentiation uses binary exponentiation in O(log exponent) multiplications, and the small inverse search is O(p); this toy only searches because p is tiny. Real OPAQUE uses elliptic curves and efficient fixed-base exponentiation.",
        uses: [
            "Password-authenticated key exchange without sending the password",
            "Augmented PAKE where the server stores a verifier, not a password",
            "A teaching model for oblivious pseudorandom functions",
        ],
        references: [
            "Krawczyk, The OPAQUE Asymmetric PAKE Protocol, 2018",
            "IETF RFC 9807, OPAQUE Asymmetric PAKE Protocol, 2025",
        ],
        workedExample:
            "With p = 101, password hunter2 hashing to h, blind r = 7, and server key k = 13, the client sends alpha = h to the 7th power. The server returns beta = alpha to the 13th power. Because 7 inverse modulo 100 is 43, the client computes beta to the 43rd power and obtains h to the 13th power, exactly the direct server-side value.",
    },
    id: "opaque-pake",
    name: "OPAQUE (OPRF Core)",
    category: "cryptography-security",
    complexity: { time: "O(log exponent)", space: "O(1)" },
    defaultInput: { p: 101, k: 13, password: "hunter2", r: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a prime modulus and a server secret exponent k",
        "client hashes the password to a group element h",
        "client picks a blind r and sends alpha equal to h to the r",
        "server returns beta equal to alpha to the k modulo p",
        "client computes the inverse of r modulo p minus one",
        "client unblinds by raising beta to that inverse",
        "done: check the result equals h to the k computed directly",
    ],
};

export default module;

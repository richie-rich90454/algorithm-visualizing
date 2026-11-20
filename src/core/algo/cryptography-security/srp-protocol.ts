/**
 * srp-protocol.ts - Secure Remote Password (Toy Prime-Field Model)
 *
 * SRP lets a client prove knowledge of a password without sending it and
 * without the server storing a password-equivalent value. The server keeps a
 * salt and a verifier g^x, the client sends g^a, the server replies with
 * k*v + g^b, and both sides derive the same session key from the transcript.
 * This module performs the exact big-integer modular arithmetic in a small
 * prime field with simple deterministic hashes. It is a teaching model, not
 * a production PAKE or a cryptographically secure hash.
 *
 * Time:  O(log p) per modular exponentiation, constant count
 * Space: O(1) field elements
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface SrpValues {
    x: number;
    verifier: number;
    A: number;
    B: number;
    u: number;
    clientSecret: number;
    serverSecret: number;
    key: number;
    match: boolean;
}

/** Modular exponentiation by repeated squaring using exact integers. */
export function srpPow(base: number, exponent: number, modulus: number): number {
    const mod = BigInt(modulus);
    let result = 1n;
    let b = ((BigInt(base) % mod) + mod) % mod;
    let e = BigInt(exponent);
    while (e > 0n) {
        if (e & 1n) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e >>= 1n;
    }
    return Number(result);
}

/** Deterministic toy hash used for x, u, and the session key. */
export function srpHash(a: number, b: number, modulus: number): number {
    return (a + b * 2654435761) % Math.max(2, modulus);
}

/** Run the full SRP exchange and return both derived session keys. */
export function srpExchange(
    prime: number,
    generator: number,
    multiplier: number,
    password: number,
    salt: number,
    clientNonce: number,
    serverNonce: number,
    claimedPassword = password,
): SrpValues {
    const p = Math.max(3, Math.trunc(prime));
    const g = Math.trunc(generator);
    const k = Math.trunc(multiplier);
    const x = srpHash(salt, password, p);
    const clientX = srpHash(salt, claimedPassword, p);
    const verifier = srpPow(g, x, p);
    const A = srpPow(g, clientNonce, p);
    const B = (k * verifier + srpPow(g, serverNonce, p)) % p;
    const u = srpHash(A, B, p);
    const clientBase = ((B - k * verifier) % p + p) % p;
    const clientExponent = clientNonce + u * clientX;
    const clientSecret = srpPow(clientBase, clientExponent, p);
    const serverBase = (A * srpPow(verifier, u, p)) % p;
    const serverSecret = srpPow(serverBase, serverNonce, p);
    const match = clientSecret === serverSecret;
    return {
        x,
        verifier,
        A,
        B,
        u,
        clientSecret,
        serverSecret,
        key: srpHash(clientSecret, serverSecret, p),
        match,
    };
}

function makeBars(values: Record<string, number>, phase: number, match: boolean): VisualEntity[] {
    const labels = ["salt", "pw", "x", "v", "A", "B", "u", "S_c", "S_s", "K"];
    return labels.map((label, index) => {
        const value = values[label] ?? 0;
        let state: EntityState = "idle";
        if (phase >= 6) {
            state = label === "K" ? (match ? "sorted" : "error") : "visited";
        } else if (phase >= 5 && (label === "S_c" || label === "S_s")) {
            state = "active";
        } else if (phase >= 4 && label === "u") {
            state = "comparing";
        } else if (phase >= 3 && label === "B") {
            state = "path";
        } else if (phase >= 2 && label === "A") {
            state = "path";
        } else if (phase >= 1 && (label === "x" || label === "v")) {
            state = "visited";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${label}=${value}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: label, value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            prime?: number;
            generator?: number;
            multiplier?: number;
            password?: number;
            salt?: number;
            clientNonce?: number;
            serverNonce?: number;
        } | null
    ) ?? {};
    const prime = typeof task.prime === "number" ? Math.max(3, Math.trunc(task.prime)) : 1000003;
    const generator = typeof task.generator === "number" ? Math.trunc(task.generator) : 2;
    const multiplier = typeof task.multiplier === "number" ? Math.trunc(task.multiplier) : 3;
    const password = typeof task.password === "number" ? Math.trunc(task.password) : 1234;
    const salt = typeof task.salt === "number" ? Math.trunc(task.salt) : 77;
    const clientNonce = typeof task.clientNonce === "number" ? Math.trunc(task.clientNonce) : 7;
    const serverNonce = typeof task.serverNonce === "number" ? Math.trunc(task.serverNonce) : 11;
    const result = srpExchange(prime, generator, multiplier, password, salt, clientNonce, serverNonce);
    const base: Record<string, number> = { salt, pw: password, x: result.x, v: result.verifier, A: result.A, B: result.B, u: result.u, S_c: 0, S_s: 0, K: 0 };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(base, 0, result.match),
        edges: [],
        description: `Toy SRP in the field modulo ${prime}; the password will never leave the client.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { prime, generator, multiplier, phase: "init", x: 0, verifier: 0, A: 0, B: 0, u: 0, match: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(base, 1, result.match),
        edges: [],
        description: `Registration: x = H(salt, password) = ${result.x}; verifier v = g^x mod p = ${result.verifier}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { prime, generator, multiplier, phase: "register", x: result.x, verifier: result.verifier, A: 0, B: 0, u: 0, match: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(base, 2, result.match),
        edges: [],
        description: `Client hello: A = g^a mod p = ${result.A} for nonce ${clientNonce}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { prime, generator, multiplier, phase: "client", x: result.x, verifier: result.verifier, A: result.A, B: 0, u: 0, match: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(base, 3, result.match),
        edges: [],
        description: `Server hello: B = k*v + g^b mod p = ${result.B} for nonce ${serverNonce}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { prime, generator, multiplier, phase: "server", x: result.x, verifier: result.verifier, A: result.A, B: result.B, u: 0, match: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(base, 4, result.match),
        edges: [],
        description: `Both sides form u = H(A, B) = ${result.u}, binding the two messages to the session.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { prime, generator, multiplier, phase: "scramble", x: result.x, verifier: result.verifier, A: result.A, B: result.B, u: result.u, match: false },
    };
    step += 1;

    const clientValues = { ...base, S_c: result.clientSecret };
    yield {
        stepNumber: step,
        entities: makeBars(clientValues, 5, result.match),
        edges: [],
        description: `Client computes S = (B - k*v)^(a + u*x) mod p = ${result.clientSecret}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { prime, generator, multiplier, phase: "client-key", x: result.x, verifier: result.verifier, A: result.A, B: result.B, u: result.u, clientSecret: result.clientSecret, match: false },
    };
    step += 1;

    const serverValues = { ...clientValues, S_s: result.serverSecret };
    yield {
        stepNumber: step,
        entities: makeBars(serverValues, 5, result.match),
        edges: [],
        description: `Server computes S = (A * v^u)^b mod p = ${result.serverSecret}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { prime, generator, multiplier, phase: "server-key", x: result.x, verifier: result.verifier, A: result.A, B: result.B, u: result.u, clientSecret: result.clientSecret, serverSecret: result.serverSecret, match: result.match },
    };
    step += 1;

    const finalValues = { ...serverValues, K: result.key };
    yield {
        stepNumber: step,
        entities: makeBars(finalValues, 6, result.match),
        edges: [],
        description: result.match
            ? `Both sides derive key ${result.key}; the password was never transmitted.`
            : `The two session secrets differ, so authentication fails.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            prime,
            generator,
            multiplier,
            phase: "done",
            x: result.x,
            verifier: result.verifier,
            A: result.A,
            B: result.B,
            u: result.u,
            clientSecret: result.clientSecret,
            serverSecret: result.serverSecret,
            key: result.key,
            match: result.match,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SRP proves knowledge of a password without ever sending it. The server stores only a verifier derived from a salt and the password. The client and server exchange one random value each, and both combine the transcript with their own secret to reach the same session key. An eavesdropper sees the messages but cannot compute either secret without the password or the server's private nonce.",
        invariants: [
            "The verifier is g raised to the hash of salt and password, never the password itself.",
            "The client secret uses B minus k times v, which equals g to the server nonce.",
            "The server secret uses A times v to the u, which equals g to the client nonce times x.",
        ],
        correctness:
            "Let x be the hashed password and v equal g to the x. The server sends B equal k v plus g to the b, so B minus k v is g to the b; the client secret is that value raised to a plus u x, giving g to the quantity b times a plus u x. The server secret is A times v to the u, which is g to a plus x u, raised to b, giving the same exponent. Both sides therefore compute the same field element and the same hashed key, while a wrong password changes x and breaks the equality.",
        complexityRationale:
            "The exchange performs a constant number of modular exponentiations, each using repeated squaring in O(log p) multiplications. All values are single field elements, so working space is constant.",
        uses: [
            "Password-authenticated key exchange in remote login systems",
            "Teaching how a verifier avoids storing password equivalents",
            "Comparing PAKE protocols with plain password transmission",
        ],
        references: [
            "Wu, The Secure Remote Password Protocol, 1998",
            "RFC 5054, Using the Secure Remote Password Protocol for TLS Authentication, 2007",
        ],
        workedExample:
            "In the field modulo one million and three with generator two, a client with password one thousand two hundred thirty four and salt seventy seven forms x and the verifier. With client nonce seven and server nonce eleven, A is two to the seventh power and B mixes the verifier with two to the eleventh. Both sides then derive the same session key, which changes if either nonce or the password changes.",
    },
    id: "srp-protocol",
    name: "SRP Protocol (Toy Prime Field)",
    category: "cryptography-security",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: {
        prime: 1000003,
        generator: 2,
        multiplier: 3,
        password: 1234,
        salt: 77,
        clientNonce: 7,
        serverNonce: 11,
    },
    visualType: "array",
    run,
    pseudocode: [
        "fix a prime field, a generator, and a hash function",
        "derive x from the salt and password and publish v = g^x",
        "client chooses nonce a and sends A = g^a",
        "server chooses nonce b and sends B = k*v + g^b",
        "both sides compute u from the two public messages",
        "client computes S = (B - k*v)^(a + u*x)",
        "server computes S = (A * v^u)^b",
        "hash S into a shared session key on both sides",
    ],
};

export default module;

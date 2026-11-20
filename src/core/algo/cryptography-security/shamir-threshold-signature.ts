/**
 * shamir-threshold-signature.ts - Shamir Sharing and a Toy Threshold Signature
 *
 * TEACHING MODEL, NOT PRODUCTION SECURITY. A signing secret is split into
 * shares with a random-looking polynomial; any threshold of shares recovers it
 * by Lagrange interpolation, and the recovered secret checks a toy signature
 * equation. No distributed signing protocol is implemented.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const Q = 1009;

function modPow(base: number, exp: number, mod: number): number {
    let result = 1;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % mod;
        b = (b * b) % mod;
        e = Math.floor(e / 2);
    }
    return result;
}

function inv(value: number): number {
    return modPow(value, Q - 2, Q);
}

function evaluate(coeffs: number[], x: number): number {
    let result = 0;
    for (let i = coeffs.length - 1; i >= 0; i -= 1) {
        result = (result * x + (coeffs[i] ?? 0)) % Q;
    }
    return ((result % Q) + Q) % Q;
}

function reconstruct(shares: Array<{ x: number; y: number }>): number {
    let secret = 0;
    for (let j = 0; j < shares.length; j += 1) {
        const sj = shares[j];
        if (!sj) continue;
        let basis = 1;
        for (let m = 0; m < shares.length; m += 1) {
            if (m === j) continue;
            const sm = shares[m];
            if (!sm) continue;
            const numerator = ((-sm.x) % Q + Q) % Q;
            const denominator = ((sj.x - sm.x) % Q + Q) % Q;
            basis = (basis * numerator * inv(denominator)) % Q;
        }
        secret = (secret + sj.y * basis) % Q;
    }
    return ((secret % Q) + Q) % Q;
}

function makeNodes(shares: Array<{ x: number; y: number }>, secret: number, revealed: number, chosen: number[], done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [
        {
            id: "secret",
            type: "node",
            label: `s=${secret}`,
            value: secret,
            state: done ? "sorted" : "pivot",
            x: 0,
            y: secret,
            width: 0,
            height: 0,
            metadata: { x: 0 },
        },
    ];
    shares.forEach((share, index) => {
        const isChosen = chosen.includes(index);
        entities.push({
            id: `share-${index}`,
            type: "node",
            label: `(${share.x},${share.y})`,
            value: share.y,
            state: index < revealed ? (done && isChosen ? "path" : "sorted") : "unvisited",
            x: share.x,
            y: share.y,
            width: 0,
            height: 0,
            metadata: { x: share.x, shareIndex: index },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { secret?: number; threshold?: number; shares?: number; message?: string } | null) ?? {};
    const secret = Math.max(1, (typeof task.secret === "number" ? task.secret : 42) % Q);
    const threshold = Math.max(2, Math.min(6, Math.floor(typeof task.threshold === "number" ? task.threshold : 3)));
    const count = Math.max(threshold, Math.min(8, Math.floor(typeof task.shares === "number" ? task.shares : 5)));
    const message = String(task.message ?? "SIGN");

    const coeffs = [secret];
    for (let i = 1; i < threshold; i += 1) {
        coeffs.push(((secret * 31 + i * 17 + 7) % (Q - 1)) + 1);
    }
    const shares = Array.from({ length: count }, (_, i) => ({ x: i + 1, y: evaluate(coeffs, i + 1) }));
    const chosen = shares.slice(0, threshold).map((_, i) => i);
    const recovered = reconstruct(chosen.map((i) => shares[i]!).filter(Boolean));

    let messageNum = 0;
    for (let i = 0; i < message.length; i += 1) {
        messageNum = (messageNum * 31 + message.charCodeAt(i)) % (Q - 1);
    }
    messageNum = messageNum + 1;
    const signature = (recovered * messageNum) % Q;
    const valid = ((signature * inv(messageNum)) % Q) === recovered;

    yield {
        stepNumber: 0,
        entities: makeNodes(shares, secret, 0, chosen, false),
        edges: [],
        description: `Splitting secret ${secret} into ${count} shares with threshold ${threshold} modulo ${Q}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { q: Q, threshold, shares: count, secret, recovered: 0, valid: false },
    };
    for (let i = 0; i < count; i += 1) {
        yield {
            stepNumber: i + 1,
            entities: makeNodes(shares, secret, i + 1, chosen, false),
            edges: [],
            description: `Share ${i + 1}: f(${shares[i]?.x}) = ${shares[i]?.y}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { q: Q, threshold, shares: count, secret, recovered: 0, valid: false },
        };
    }
    yield {
        stepNumber: count + 1,
        entities: makeNodes(shares, secret, count, chosen, true),
        edges: chosen.map((i) => ({
            id: `edge-${i}`,
            sourceId: `share-${i}`,
            targetId: "secret",
            label: "",
            state: "path" as const,
            directed: true,
        })),
        description: `Any ${threshold} shares interpolate to secret ${recovered}; signature ${signature} verifies: ${valid}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { q: Q, threshold, shares: count, secret, recovered, signature, valid, messageNum },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of trusting one person with a signing key, you can hand out shares so that only a quorum can reconstruct it. Shamir's scheme hides the secret in a polynomial: each share is one point, and the secret is the value at zero, recovered by interpolation once enough points are known.",
        invariants: [
            "The polynomial has degree threshold minus one and constant term equal to the secret.",
            "Any threshold of distinct share points determines the polynomial uniquely.",
            "Fewer than threshold points leave the constant term undetermined.",
        ],
        correctness:
            "Lagrange interpolation expresses the value at zero as a weighted sum of the share values, with weights built from the other share x coordinates. Because the polynomial has degree below the threshold, any threshold of shares reproduces the same constant term, and different subsets give the same secret. The toy signature check then multiplies by the message and divides it back to test the recovered secret; this is an illustration, not a real threshold signature protocol.",
        complexityRationale:
            "Generating shares evaluates a degree t polynomial at n points in O(n*t) time; reconstructing from t shares costs O(t^2) modular operations with the simple Lagrange formula.",
        uses: [
            "Splitting certificate authority or cryptocurrency keys",
            "Requiring a quorum to authorize a sensitive action",
            "Distributed key generation and threshold cryptography",
        ],
        references: [
            "Shamir, How to Share a Secret, 1979",
            "Desmedt, Society and Group Oriented Cryptography, 1987",
        ],
        workedExample:
            "With secret 42, threshold 3, and five shares modulo 1009, the polynomial f(x) = 42 + a*x + b*x^2 gives distinct points at x = 1 through 5. Taking the first three shares and applying Lagrange interpolation at zero returns 42, and the toy signature check accepts.",
    },
    id: "shamir-threshold-signature",
    name: "Shamir Threshold Signature (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(n*t + t^2)", space: "O(n)" },
    defaultInput: { secret: 42, threshold: 3, shares: 5, message: "SIGN" },
    visualType: "point",
    run,
    pseudocode: [
        "choose a prime modulus and a secret equal to the polynomial constant term",
        "pick random-looking coefficients up to degree threshold minus one",
        "evaluate the polynomial at each share x coordinate",
        "gather any threshold of shares and compute Lagrange weights at zero",
        "sum the weighted shares to recover the secret",
        "check the toy signature equation with the recovered secret",
        "done: report the reconstructed secret and verification result",
    ],
};

export default module;

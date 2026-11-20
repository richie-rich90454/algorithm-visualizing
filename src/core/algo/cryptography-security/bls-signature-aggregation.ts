/**
 * bls-signature-aggregation.ts - BLS Signature Aggregation (Toy Pairing)
 *
 * Demonstrates the aggregation equation that makes BLS signatures useful: many
 * signatures can be multiplied into one short aggregate, and verification
 * uses a bilinear map so a single pairing check validates them all. A tiny
 * prime field with a brute-force discrete log simulates the pairing, which is
 * exact arithmetic but not a production pairing or a secure BLS scheme.
 *
 * Time:  O(signers * (log p + p)) with brute-force logs  Space: O(signers)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Signer {
    secret?: number;
    message?: string;
}

interface BLSInput {
    p?: number;
    g?: number;
    signers?: Signer[];
    verifyMessages?: string[];
}

function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let k = exponent;
    while (k > 0) {
        if (k % 2 === 1) {
            result = (result * b) % modulus;
        }
        b = (b * b) % modulus;
        k = Math.trunc(k / 2);
    }
    return result;
}

/** Brute-force discrete logarithm in a small prime field. */
function dlog(g: number, target: number, p: number, order: number): number {
    let value = 1;
    for (let k = 0; k < order; k += 1) {
        if (value === target) {
            return k;
        }
        value = (value * g) % p;
    }
    return -1;
}

/** Toy bilinear map e(X, Y) = g to the (log X times log Y) modulo p. */
function pairing(X: number, Y: number, g: number, p: number, order: number): number {
    const lx = dlog(g, X, p, order);
    const ly = dlog(g, Y, p, order);
    if (lx < 0 || ly < 0) {
        return -1;
    }
    return modPow(g, (lx * ly) % order, p);
}

/** Deterministic toy hash-to-field value. */
function hashToField(message: string, index: number, order: number): number {
    let sum = index * 7;
    for (let i = 0; i < message.length; i += 1) {
        sum = (sum + message.charCodeAt(i)) % order;
    }
    return sum % order;
}

function makeCells(rows: Array<[string, number | string]>, highlight: number): VisualEntity[] {
    return rows.map(([label, value], col) => ({
        id: `cell-0-${col}`,
        type: "cell",
        label: `${label}=${value}`,
        value: typeof value === "number" ? value : -1,
        state: (col === highlight ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BLSInput | null) ?? {};
    const p = typeof task.p === "number" && task.p > 2 ? Math.trunc(task.p) : 11;
    const g = typeof task.g === "number" ? Math.trunc(task.g) : 2;
    const order = p - 1;
    const signers: Signer[] = Array.isArray(task.signers)
        ? task.signers
        : [
              { secret: 3, message: "alpha" },
              { secret: 4, message: "beta" },
              { secret: 5, message: "gamma" },
          ];

    const hValues: number[] = [];
    const HValues: number[] = [];
    const AValues: number[] = [];
    const sigmas: number[] = [];
    for (let i = 0; i < signers.length; i += 1) {
        const a = ((signers[i]?.secret ?? 1) % order + order) % order;
        const message = signers[i]?.message ?? "";
        const h = hashToField(message, i, order);
        const H = modPow(g, h, p);
        const A = modPow(g, a, p);
        const sigma = modPow(H, a, p);
        hValues.push(h);
        HValues.push(H);
        AValues.push(A);
        sigmas.push(sigma);
    }
    const aggregate = sigmas.reduce((product, sigma) => (product * sigma) % p, 1);
    // Verification hashes can be overridden to model altered messages.
    const verifyH = Array.isArray(task.verifyMessages)
        ? task.verifyMessages.map((message, i) => hashToField(message, i, order))
        : hValues;
    const verifyHPoints = verifyH.map((h) => modPow(g, h, p));
    const lhs = pairing(aggregate, g, g, p, order);
    let rhs = 1;
    for (let i = 0; i < signers.length; i += 1) {
        const term = pairing(verifyHPoints[i] ?? 1, AValues[i] ?? 1, g, p, order);
        rhs = (rhs * term) % p;
    }
    const valid = lhs >= 0 && rhs >= 0 && lhs === rhs;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["p", p],
                ["g", g],
                ["signers", signers.length],
            ],
            -1,
        ),
        edges: [],
        description: `Toy BLS aggregation in the field modulo ${p} with ${signers.length} signers.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: 3,
            p,
            g,
            signers: signers.length,
            h: hValues,
            H: HValues,
            A: AValues,
            sigmas,
            verifyH,
            aggregate,
            lhs,
            rhs,
            valid,
        },
    };
    step += 1;

    for (let i = 0; i < signers.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(
                [
                    ["h", hValues[i]],
                    ["H", HValues[i]],
                    ["sigma", sigmas[i]],
                ],
                2,
            ),
            edges: [],
            description: `Signer ${i}: hash ${hValues[i]}, hashed point H ${HValues[i]}, signature H^a = ${sigmas[i]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 1, cols: 3, signer: i, h: hValues, H: HValues, A: AValues, sigmas, aggregate: 0 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["sigmas", sigmas.join("*")],
                ["aggregate", aggregate],
                ["mod", p],
            ],
            1,
        ),
        edges: [],
        description: `Aggregate signature = product of ${sigmas.length} signatures modulo ${p} = ${aggregate}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 1, cols: 3, sigmas, aggregate, p },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["e(agg,g)", lhs],
                ["prod e(H,A)", rhs],
                ["valid", String(valid)],
            ],
            2,
        ),
        edges: [],
        description: `Pairing check: e(aggregate,g) = ${lhs} and product e(H_i,A_i) = ${rhs}; aggregate ${valid ? "valid" : "INVALID"}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows: 1, cols: 3, aggregate, lhs, rhs, valid, sigmas, H: HValues, A: AValues },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Boneh-Lynn-Shacham signatures live in a group with a bilinear pairing, which lets a verifier combine many signatures into one. Instead of checking each signature separately, you multiply them into a single aggregate and check one pairing equation. The toy model here replaces the pairing with a small discrete-log calculation, which is exact but not cryptographically secure.",
        invariants: [
            "Each signer's signature is the hashed message raised to that signer's secret exponent.",
            "The aggregate signature is the product of all individual signatures in the group.",
            "Verification checks that the pairing of the aggregate equals the product of the individual pairings.",
        ],
        correctness:
            "If sigma_i = H_i to the a_i, then the aggregate is g to the sum of h_i times a_i. The toy pairing maps g to the u and g to the v to g to the u times v, so the pairing of the aggregate with g equals g to that same sum, which is exactly the product of the pairings of each H_i with its public key A_i. Matching values mean every signature was formed with the matching secret.",
        complexityRationale:
            "Signing each message costs one exponentiation, O(log p). The toy pairing brute-forces a discrete log in O(p) time per evaluation, which is why the parameters are tiny; a real pairing is constant time in the security parameter.",
        uses: [
            "Compact multi-signature aggregation in blockchain protocols",
            "Reducing verification cost for many signers",
            "Threshold and distributed signing schemes",
        ],
        references: [
            "Boneh, Lynn and Shacham, Short Signatures from the Weil Pairing, 2001",
            "Boneh et al., Aggregate and Verifiably Encrypted Signatures, 2003",
        ],
        workedExample:
            "With p=11, g=2 and three signers, each hashed message becomes a group element H_i and each signature is H_i raised to the secret a_i. Multiplying the three signatures gives one aggregate residue modulo 11. The toy pairing of that aggregate with g equals the product of pairings (H_i, A_i), so a single comparison validates all three at once.",
    },
    id: "bls-signature-aggregation",
    name: "BLS Signature Aggregation (Toy Pairing)",
    category: "cryptography-security",
    complexity: { time: "O(signers * (log p + p))", space: "O(signers)" },
    defaultInput: {
        p: 11,
        g: 2,
        signers: [
            { secret: 3, message: "alpha" },
            { secret: 4, message: "beta" },
            { secret: 5, message: "gamma" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a small prime field and a generator",
        "for each signer hash the message into a group element",
        "sign by raising the hashed element to the secret key",
        "multiply all signatures into one aggregate",
        "compute the pairing of the aggregate with the generator",
        "compute the product of pairings of each hash and public key",
        "accept when the two pairing values match for the verified messages",
        "done: report whether the aggregate is valid",
    ],
};

export default module;

/**
 * verifiable-secret-sharing.ts - Feldman Verifiable Secret Sharing (Toy Field)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Feldman verifiable secret sharing extends Shamir sharing with public
 * commitments to the coefficients of the sharing polynomial. Each participant
 * can check its own share against those commitments without learning the
 * secret, and any threshold of verified shares reconstructs the secret by
 * Lagrange interpolation. This module uses a tiny prime field, so it is a
 * faithful teaching model and makes no security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n * t) modular operations for n shares and threshold t
 *   Space: O(n + t) for shares and commitments
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One cell per share shows its value and verification verdict.
 *   - A valid share is green; a tampered share is red.
 *   - meta carries commitments, verdicts, and the reconstructed secret.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 23;
const Q = 11;
const G = 2;

/** Exact modular exponentiation by repeated squaring. */
export function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let current = ((base % modulus) + modulus) % modulus;
    let power = Math.floor(exponent);
    while (power > 0) {
        if (power % 2 === 1) {
            result = (result * current) % modulus;
        }
        current = (current * current) % modulus;
        power = Math.floor(power / 2);
    }
    return result;
}

/** Modular inverse in the prime field Q using Fermat's little theorem. */
function inverse(value: number): number {
    return powMod(((value % Q) + Q) % Q, Q - 2, Q);
}

/** Evaluate the secret polynomial at a point modulo Q. */
export function evaluate(coefficients: number[], x: number): number {
    let result = 0;
    let power = 1;
    for (const coefficient of coefficients) {
        result = (result + coefficient * power) % Q;
        power = (power * x) % Q;
    }
    return ((result % Q) + Q) % Q;
}

/** Check a share against the Feldman commitments. */
export function verify(commitments: number[], x: number, share: number): boolean {
    let product = 1;
    let power = 1;
    for (const commitment of commitments) {
        product = (product * powMod(commitment, power, P)) % P;
        power = (power * x) % Q;
    }
    return powMod(G, share, P) === product;
}

/** Reconstruct the constant term from any threshold of shares. */
export function reconstruct(points: Array<{ x: number; y: number }>): number {
    let secret = 0;
    for (let i = 0; i < points.length; i += 1) {
        const point = points[i];
        if (!point) {
            continue;
        }
        let basis = 1;
        for (let j = 0; j < points.length; j += 1) {
            if (i === j) {
                continue;
            }
            const other = points[j];
            if (!other) {
                continue;
            }
            const numerator = ((-other.x) % Q + Q) % Q;
            const denominator = ((point.x - other.x) % Q + Q) % Q;
            basis = (basis * numerator % Q) * inverse(denominator) % Q;
        }
        secret = (secret + point.y * basis) % Q;
    }
    return ((secret % Q) + Q) % Q;
}

/** Build one cell per share showing its value and verdict. */
function makeCells(
    shares: number[],
    verdicts: boolean[],
    active: number,
    includeReconstruction: boolean,
    reconstructed: number,
): VisualEntity[] {
    const cells: VisualEntity[] = shares.map((share, index) => {
        const valid = verdicts[index] !== false;
        const state: EntityState = index === active
            ? "comparing"
            : valid
                ? "sorted"
                : "error";
        return {
            id: `share-${index}`,
            type: "cell" as const,
            label: `x=${index + 1}: ${share}${valid ? "" : " (bad)"}`,
            value: share,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, share, valid: valid ? 1 : 0 },
        };
    });
    if (includeReconstruction) {
        cells.push({
            id: "secret",
            type: "cell" as const,
            label: `secret: ${reconstructed}`,
            value: reconstructed,
            state: "active",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: 0, secret: reconstructed },
        });
    }
    return cells;
}

/** The Feldman verifiable secret sharing generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { secret?: number; threshold?: number; shares?: number; coefficients?: number[] } | null) ?? {};
    const secret = ((Math.floor(task.secret ?? 7) % Q) + Q) % Q;
    const threshold = Math.max(2, Math.min(4, Math.floor(task.threshold ?? 3)));
    const shareCount = Math.max(threshold, Math.min(8, Math.floor(task.shares ?? 5)));
    const coefficients = Array.isArray(task.coefficients) && task.coefficients.length === threshold - 1
        ? task.coefficients.map((value) => ((Math.floor(value) % Q) + Q) % Q)
        : Array.from({ length: threshold - 1 }, (_, index) => [3, 5, 2][index] ?? 1);
    const allCoefficients = [secret, ...coefficients];
    const commitments = allCoefficients.map((coefficient) => powMod(G, coefficient, P));
    const shares = Array.from({ length: shareCount }, (_, index) => evaluate(allCoefficients, index + 1));
    const verdicts = shares.map((share, index) => verify(commitments, index + 1, share));
    const points = shares.slice(0, threshold).map((share, index) => ({ x: index + 1, y: share }));
    const reconstructed = reconstruct(points);

    yield {
        stepNumber: 0,
        entities: makeCells(shares, shares.map(() => true), -1, false, 0),
        edges: [],
        description: `Feldman sharing of a secret with threshold ${threshold} across ${shareCount} participant(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: shareCount,
            secret,
            threshold,
            commitments: [] as number[],
            shares,
            verdicts: [] as number[],
            reconstructed: 0,
        },
    };

    yield {
        stepNumber: 1,
        entities: makeCells(shares, shares.map(() => true), -1, false, 0),
        edges: [],
        description: `Publish commitments ${commitments.join(", ")} to the polynomial coefficients.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: 1, cols: shareCount, secret, threshold, commitments, shares, verdicts: [] as number[], reconstructed: 0 },
    };

    let step = 2;
    for (let index = 0; index < shares.length; index += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(shares, verdicts, index, false, 0),
            edges: [],
            description: `Participant ${index + 1} verifies share ${shares[index]} ${verdicts[index] ? "successfully" : "and finds it invalid"}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: shareCount,
                secret,
                threshold,
                commitments,
                shares,
                verdicts: verdicts.slice(0, index + 1).map((value) => (value ? 1 : 0)),
                reconstructed: 0,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(shares, verdicts, -1, true, reconstructed),
        edges: [],
        description: `Lagrange interpolation of ${threshold} shares recovers the secret ${reconstructed}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: 2,
            cols: shareCount,
            secret,
            threshold,
            commitments,
            shares,
            verdicts: verdicts.map((value) => (value ? 1 : 0)),
            reconstructed,
            done: true,
        },
    };
}

/** The Feldman verifiable secret sharing module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A dealer hides a secret as the constant term of a random polynomial and hands each participant a point on it. Along with the shares, the dealer publishes commitments to the polynomial coefficients. Each participant checks its point against those commitments, so a dishonest dealer cannot give inconsistent shares, and any threshold of honest participants can rebuild the polynomial and read the secret.",
        invariants: [
            "Every share is the polynomial evaluated at a distinct nonzero point.",
            "A share verifies exactly when it lies on the committed polynomial.",
            "Any threshold of valid shares reconstructs the same constant term.",
        ],
        correctness:
            "The commitment to a share point is the product of each coefficient commitment raised to the corresponding power of x, which equals the generator raised to the polynomial value by the laws of exponents, so an honest share always verifies. Two distinct polynomials of degree below the threshold cannot share the committed constant term unless their coefficient commitments match, giving binding. Lagrange interpolation through threshold valid points is the unique polynomial of that degree, so it recovers the secret exactly.",
        complexityRationale:
            "Publishing t plus one commitments, evaluating n shares, and verifying each share against t commitments take O(n times t) modular operations. Reconstruction is O(t squared) without optimization. Shares and commitments use O(n + t) space.",
        uses: [
            "Distributed key generation and threshold signing",
            "Verifiable randomness beacons",
            "Teaching the bridge from Shamir sharing to commitment schemes",
        ],
        references: [
            "Feldman, A Practical Scheme for Non-Interactive Verifiable Secret Sharing, 1987",
            "Shamir, How to Share a Secret, 1979",
        ],
        workedExample:
            "With secret 7, threshold 3, and coefficients 3 and 5 modulo 11, the polynomial gives shares 4, 0, 6, 0, 4 for points 1 through 5. Publishing generator powers 13, 8, and 9 modulo 23 lets each participant check its share. Interpolating the first three shares returns 7, the original secret.",
    },
    id: "verifiable-secret-sharing",
    name: "Verifiable Secret Sharing (Toy Field)",
    category: "cryptography-security",
    complexity: { time: "O(n * t)", space: "O(n + t)" },
    defaultInput: { secret: 7, threshold: 3, shares: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a threshold and a prime field",
        "build a polynomial whose constant term is the secret",
        "publish commitments to every polynomial coefficient",
        "give each participant the polynomial evaluated at its point",
        "verify each share against the published commitments",
        "collect any threshold of verified shares",
        "interpolate the constant term from those shares",
        "done: report the verdicts and the reconstructed secret",
    ],
};

export default module;

/**
 * proactive-secret-sharing.ts - Proactive Secret Sharing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Proactive secret sharing refreshes the shares of a secret periodically
 * without changing the secret itself. Each participant starts with a Shamir
 * share on a degree t-1 polynomial whose constant term is the secret. During a
 * refresh every participant picks a random polynomial of the same degree whose
 * constant term is zero, sends a share of it to each peer, and adds all
 * received contributions to their own share. The sum polynomial still has the
 * original constant term, so the new shares reconstruct the same secret, while
 * a set of stale shares no longer combines with a fresh quorum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) to refresh n shares; O(t^2) to reconstruct from t shares
 *   Space: O(n) for the share array and refresh contributions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per participant showing the current share value.
 *   - The bars switch from stale to fresh after the refresh round.
 *   - meta carries old shares, new shares and both reconstruction results.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ProactiveInput {
    secret?: number;
    threshold?: number;
    parties?: number;
    p?: number;
    seed?: number[];
}

/** Evaluate a polynomial in coefficient order at a point over a prime field. */
function evaluate(coeffs: number[], x: number, p: number): number {
    let result = 0;
    for (let i = coeffs.length - 1; i >= 0; i -= 1) result = (result * x + (coeffs[i] ?? 0)) % p;
    return ((result % p) + p) % p;
}

/** Modular inverse in a small prime field by exhaustive search. */
function invert(value: number, p: number): number {
    const v = ((value % p) + p) % p;
    for (let i = 1; i < p; i += 1) if ((v * i) % p === 1) return i;
    return 1;
}

/** Lagrange interpolation at zero: recover the constant term. */
function reconstruct(shares: Array<{ x: number; y: number }>, p: number): number {
    let result = 0;
    for (let i = 0; i < shares.length; i += 1) {
        const a = shares[i]!;
        let basis = 1;
        for (let j = 0; j < shares.length; j += 1) {
            if (i === j) continue;
            const b = shares[j]!;
            basis = (basis * (0 - b.x) * invert(a.x - b.x, p)) % p;
        }
        result = (result + a.y * basis) % p;
    }
    return ((result % p) + p) % p;
}

/** Build one bar per share. */
function makeBars(shares: number[], fresh: boolean, focus: number): VisualEntity[] {
    return shares.map((value, i) => ({
        id: `share-${i + 1}`,
        type: "bar" as const,
        label: `P${i + 1}:${value}`,
        value,
        state: (i === focus ? "active" : fresh ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i + 1, value, fresh: fresh ? 1 : 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ProactiveInput | null) ?? {};
    const p = Math.max(7, Math.floor(Number(task.p ?? 257)) || 257);
    const threshold = Math.max(2, Math.min(6, Math.floor(Number(task.threshold ?? 3)) || 3));
    const parties = Math.max(threshold, Math.min(9, Math.floor(Number(task.parties ?? 5)) || 5));
    const secret = ((Math.floor(Number(task.secret ?? 123)) % p) + p) % p;
    const seed = Array.isArray(task.seed) && task.seed.length > 0
        ? task.seed.map((v) => Math.floor(Number(v) || 0))
        : [11, 23, 37, 41, 53, 67, 71, 89];
    let cursor = 0;
    const next = (): number => {
        const value = ((seed[cursor % seed.length] ?? 0) + cursor * 17) % p;
        cursor += 1;
        return value;
    };

    const polynomial = [secret];
    for (let d = 1; d < threshold; d += 1) polynomial.push(next());
    const oldShares = Array.from({ length: parties }, (_, i) => evaluate(polynomial, i + 1, p));

    const refreshPolynomials = Array.from({ length: parties }, () => {
        const coeffs = [0];
        for (let d = 1; d < threshold; d += 1) coeffs.push(next());
        return coeffs;
    });
    const contributions = Array.from({ length: parties }, (_, receiver) =>
        refreshPolynomials.reduce((sum, poly) => (sum + evaluate(poly, receiver + 1, p)) % p, 0),
    );
    const newShares = oldShares.map((value, i) => (value + (contributions[i] ?? 0)) % p);

    const point = (shares: number[], count: number) => shares.slice(0, count).map((y, i) => ({ x: i + 1, y }));
    const oldResult = reconstruct(point(oldShares, threshold), p);
    const newResult = reconstruct(point(newShares, threshold), p);
    const mixed = reconstruct(
        [...point(oldShares, threshold - 1), ...point(newShares, 1)].map((entry, i) => i < threshold - 1 ? entry : { x: threshold, y: newShares[threshold - 1] ?? 0 }),
        p,
    );
    const match = oldResult === secret && newResult === secret;
    let step = 0;
    const emit = (description: string, codeLine: number, shares: number[], fresh: boolean, focus: number, extra: Record<string, unknown>) => ({
        stepNumber: step++,
        entities: makeBars(shares, fresh, focus),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "array" as const,
        meta: {
            p,
            threshold,
            parties,
            secret,
            oldShares: oldShares.slice(),
            newShares: newShares.slice(),
            contributions: contributions.slice(),
            oldResult,
            newResult,
            mixed,
            match: match ? 1 : 0,
            ...extra,
        },
    });

    yield emit(`Shamir sharing of secret ${secret} among ${parties} parties with threshold ${threshold}.`, 0, oldShares, false, -1, { phase: "setup" });
    yield emit(`Original shares evaluated on the secret polynomial: [${oldShares.join(", ")}].`, 2, oldShares, false, -1, { phase: "shares" });
    for (let i = 0; i < parties; i += 1) {
        yield emit(`Party ${i + 1} distributes a zero-constant refresh polynomial contribution ${contributions[i]}.`, 4, oldShares, false, i, { phase: "refresh" });
    }
    yield emit(`Each party adds the contributions to obtain fresh shares [${newShares.join(", ")}].`, 6, newShares, true, -1, { phase: "fresh" });
    yield emit(`Old quorum reconstructs ${oldResult} and fresh quorum reconstructs ${newResult}; secret is ${secret}.`, 8, newShares, true, -1, { phase: "verify" });
    yield emit(
        match
            ? `Verified: both quorums recover ${secret}, while a stale-plus-fresh mix gives ${mixed} and cannot be trusted.`
            : "Verification failed: a quorum did not recover the original secret.",
        8,
        newShares,
        true,
        -1,
        { phase: "done" },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Split a secret among several servers with a polynomial whose constant term is the secret; any threshold of them can interpolate it. To limit the damage from a slow attacker who steals one share per period, refresh periodically: every server sends out shares of a random polynomial with constant term zero and adds what it receives to its own share. The sum polynomial has the same secret at zero but new values everywhere else, so old shares become useless. No dealer is needed and the secret is never reconstructed during a refresh.",
        invariants: [
            "The refresh polynomials all have zero constant term.",
            "The new shares lie on the old polynomial plus the sum of the refresh polynomials.",
            "Any threshold of old shares and any threshold of new shares reconstruct the same secret.",
        ],
        correctness:
            "Let f be the original polynomial with f(0) equal to the secret. Each refresh polynomial g_i has g_i(0) = 0, so the combined polynomial h = f plus all g_i satisfies h(0) = f(0). Each new share is h evaluated at that party's public x coordinate. Lagrange interpolation at zero of any threshold of points on h returns h(0), the secret. Because the g_i are random and nonzero away from zero, a stale share and a fresh share do not lie on one polynomial together, so mixing them yields a value unrelated to the secret.",
        complexityRationale:
            "Each of the n parties sends one contribution to each of the n parties and evaluates a degree t-1 polynomial, costing O(n^2) field operations. Reconstruction multiplies t basis polynomials, costing O(t^2). Storage is one field element per party.",
        uses: [
            "Long-lived threshold signing keys that rotate shares periodically",
            "Distributed key management that tolerates gradual compromise",
            "Refreshing shares without revealing the secret to any participant",
        ],
        references: [
            "Herzberg, Jarecki, Krawczyk, and Yung, Proactive Secret Sharing, CRYPTO 1995",
            "Shamir, How to Share a Secret, 1979",
        ],
        workedExample:
            "Three of five servers hold shares of secret 123 on a quadratic polynomial. Each server picks a random quadratic with zero constant term and sends one evaluation to every peer. After adding the received values, each server holds a fresh share. Any three fresh shares interpolate back to 123, while two old shares combined with one fresh share interpolate to an unrelated value.",
    },
    id: "proactive-secret-sharing",
    name: "Proactive Secret Sharing",
    category: "cryptography-security",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        secret: 123,
        threshold: 3,
        parties: 5,
        p: 257,
        seed: [11, 23, 37, 41, 53, 67, 71, 89],
    },
    visualType: "array",
    run,
    pseudocode: [
        "choose a prime field, a threshold and a number of parties",
        "build a secret polynomial with the secret as constant term",
        "evaluate it at each party's public coordinate",
        "for each party build a random polynomial with zero constant term",
        "send one evaluation of that polynomial to every party",
        "each party adds all received contributions to its share",
        "interpolate old shares at zero to recover the secret",
        "interpolate new shares at zero to confirm it is unchanged",
        "done: report both reconstructions and the mixed quorum value",
    ],
};

export default module;

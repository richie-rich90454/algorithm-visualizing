/**
 * x25519-key-exchange.ts - X25519 Montgomery Ladder (Small-Field Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is a faithful but tiny model of the X25519 key exchange. It uses the
 * same constant-time-style Montgomery ladder on the x-coordinates of a
 * Montgomery curve, but over the small prime field modulo 1019 instead of the
 * 255-bit field of Curve25519. Alice and Bob derive a shared u-coordinate by
 * multiplying each other's public point by their secret scalar. The tiny field
 * makes toy parameters easy to verify; it is NOT secure and must never be used
 * for real key exchange.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log k) ladder steps for a k-bit scalar
 *   Space: O(log k) for the recorded ladder trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A key/value grid shows the ladder registers (x2, z2, x3, z3), the
 *     current scalar bit, and whether a conditional swap occurred.
 *   - Frames are emitted for each bit of the secret scalars and for the two
 *     shared-secret computations.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Toy curve parameters. p = 1019 is prime and 1019 mod 4 = 3. */
export const P = 1019n;
export const A = 1n;
export const A24 = 764n; // (A - 2) / 4 modulo P
export const BASE_U = 2n;

const mod = (value: bigint): bigint => ((value % P) + P) % P;

function powMod(base: bigint, exponent: bigint): bigint {
    let result = 1n;
    let b = mod(base);
    let e = exponent;
    while (e > 0n) {
        if (e & 1n) {
            result = mod(result * b);
        }
        b = mod(b * b);
        e >>= 1n;
    }
    return result;
}

const invMod = (value: bigint): bigint => powMod(value, P - 2n);

interface LadderStep {
    bit: string;
    kt: number;
    swap: number;
    x2: bigint;
    z2: bigint;
    x3: bigint;
    z3: bigint;
}

/** Montgomery ladder x-coordinate scalar multiplication with a full trace. */
export function ladderTrace(scalar: number, u: bigint): { steps: LadderStep[]; result: bigint } {
    let x2 = 1n;
    let z2 = 0n;
    let x3 = mod(u);
    let z3 = 1n;
    let swap = 0;
    const steps: LadderStep[] = [];
    const bits = scalar.toString(2);
    for (const char of bits) {
        const kt = char === "1" ? 1 : 0;
        swap ^= kt;
        if (swap === 1) {
            [x2, x3] = [x3, x2];
            [z2, z3] = [z3, z2];
        }
        const swapBefore = swap;
        swap = kt;
        const aa = mod((x2 + z2) * (x2 + z2));
        const bb = mod((x2 - z2) * (x2 - z2));
        const ee = mod(aa - bb);
        const cc = mod(x3 + z3);
        const dd = mod(x3 - z3);
        const da = mod(dd * (x2 + z2));
        const cb = mod(cc * (x2 - z2));
        x3 = mod((da + cb) * (da + cb));
        z3 = mod(u * (da - cb) * (da - cb));
        x2 = mod(aa * bb);
        z2 = mod(ee * (aa + A24 * ee));
        steps.push({ bit: char, kt, swap: swapBefore, x2, z2, x3, z3 });
    }
    if (swap === 1) {
        [x2, x3] = [x3, x2];
        [z2, z3] = [z3, z2];
    }
    return { steps, result: z2 === 0n ? 0n : mod(x2 * invMod(z2)) };
}

/** Convenience wrapper used by the tests. */
export function xmul(scalar: number, u: bigint): bigint {
    return ladderTrace(scalar, u).result;
}

/** Build the ladder-register grid cells. */
function makeCells(entries: Array<[string, string]>, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < entries.length; row += 1) {
        const entry = entries[row] ?? ["", ""];
        const state: EntityState = row === current ? "comparing" : "sorted";
        entities.push({
            id: `cell-${row}-0`,
            type: "cell",
            label: entry[0],
            value: entry[0],
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col: 0 },
        });
        entities.push({
            id: `cell-${row}-1`,
            type: "cell",
            label: entry[1],
            value: entry[1],
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col: 1 },
        });
    }
    return entities;
}

const ROWS = 8;

/** The X25519 toy generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { aliceSecret?: number; bobSecret?: number; baseU?: number } | null) ?? {};
    const alice = typeof task.aliceSecret === "number" ? Math.max(1, task.aliceSecret) : 5;
    const bob = typeof task.bobSecret === "number" ? Math.max(1, task.bobSecret) : 7;
    const baseU = BigInt(typeof task.baseU === "number" ? task.baseU : Number(BASE_U));

    const metaBase = { p: Number(P), a24: Number(A24), baseU: Number(baseU) };
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["curve", "u^2 = u^3 + u"],
                ["field", `mod ${P}`],
                ["a24", String(A24)],
                ["alice secret", String(alice)],
                ["bob secret", String(bob)],
                ["alice public", "?"],
                ["bob public", "?"],
                ["shared", "?"],
            ],
            -1,
        ),
        edges: [],
        description: `X25519 toy ladder over the field modulo ${P} (not secure; real X25519 uses a 255-bit field).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, rows: ROWS, cols: 2, phase: "setup", alice, bob },
    };
    step += 1;

    const aliceTrace = ladderTrace(alice, baseU);
    const bobTrace = ladderTrace(bob, baseU);
    const alicePublic = aliceTrace.result;
    const bobPublic = bobTrace.result;

    for (const [name, secret, trace] of [
        ["Alice", alice, aliceTrace],
        ["Bob", bob, bobTrace],
    ] as const) {
        for (const ladderStep of trace.steps) {
            yield {
                stepNumber: step,
                entities: makeCells(
                    [
                        ["who", name],
                        ["scalar", String(secret)],
                        ["bit", ladderStep.bit],
                        ["kt", String(ladderStep.kt)],
                        ["swap", String(ladderStep.swap)],
                        ["x2", String(ladderStep.x2)],
                        ["z2", String(ladderStep.z2)],
                        ["x3", String(ladderStep.x3)],
                    ],
                    5,
                ),
                edges: [],
                description: `${name} ladder bit ${ladderStep.bit}: swap ${ladderStep.swap}, x2 ${ladderStep.x2}, z2 ${ladderStep.z2}.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: {
                    ...metaBase,
                    rows: ROWS,
                    cols: 2,
                    phase: "public",
                    who: name,
                    scalar: secret,
                    bit: ladderStep.bit,
                    swap: ladderStep.swap,
                    x2: Number(ladderStep.x2),
                    z2: Number(ladderStep.z2),
                    x3: Number(ladderStep.x3),
                    z3: Number(ladderStep.z3),
                },
            };
            step += 1;
        }
        yield {
            stepNumber: step,
            entities: makeCells(
                [
                    ["curve", "u^2 = u^3 + u"],
                    ["field", `mod ${P}`],
                    ["a24", String(A24)],
                    ["alice secret", String(alice)],
                    ["bob secret", String(bob)],
                    ["alice public", String(alicePublic)],
                    ["bob public", trace === aliceTrace ? "?" : String(bobPublic)],
                    ["shared", "?"],
                ],
                5,
            ),
            edges: [],
            description: `${name}'s public u-coordinate is ${trace.result}.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: {
                ...metaBase,
                rows: ROWS,
                cols: 2,
                phase: "public-result",
                who: name,
                alicePublic: Number(alicePublic),
                bobPublic: trace === bobTrace ? Number(bobPublic) : 0,
            },
        };
        step += 1;
    }

    const aliceShared = ladderTrace(alice, bobPublic).result;
    const bobShared = ladderTrace(bob, alicePublic).result;
    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["curve", "u^2 = u^3 + u"],
                ["field", `mod ${P}`],
                ["a24", String(A24)],
                ["alice secret", String(alice)],
                ["bob secret", String(bob)],
                ["alice public", String(alicePublic)],
                ["bob public", String(bobPublic)],
                ["shared", String(aliceShared)],
            ],
            7,
        ),
        edges: [],
        description: `Alice derives shared u-coordinate ${aliceShared} from Bob's public key.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...metaBase,
            rows: ROWS,
            cols: 2,
            phase: "shared",
            alicePublic: Number(alicePublic),
            bobPublic: Number(bobPublic),
            aliceShared: Number(aliceShared),
            bobShared: Number(bobShared),
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(
            [
                ["curve", "u^2 = u^3 + u"],
                ["field", `mod ${P}`],
                ["a24", String(A24)],
                ["alice secret", String(alice)],
                ["bob secret", String(bob)],
                ["alice public", String(alicePublic)],
                ["bob public", String(bobPublic)],
                ["shared", String(aliceShared)],
            ],
            -1,
        ),
        edges: [],
        description: `Done: both sides agree on ${aliceShared} (toy field, no security).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            ...metaBase,
            rows: ROWS,
            cols: 2,
            phase: "done",
            alicePublic: Number(alicePublic),
            bobPublic: Number(bobPublic),
            aliceShared: Number(aliceShared),
            bobShared: Number(bobShared),
            agreed: aliceShared === bobShared,
        },
    };
}

/** The X25519 toy module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Both sides agree on a public curve point. Each raises it to a secret scalar, publishes the resulting point, and raises the other side's point to their own secret. Because scalar multiplications commute, both arrive at the same shared point without ever sending a secret over the wire.",
        invariants: [
            "Every arithmetic operation is reduced modulo the field prime 1019.",
            "The ladder multiplies by scanning the scalar bits from most to least significant.",
            "Alice's shared point equals Bob's shared point because a times b times P is the same in either order.",
        ],
        correctness:
            "The Montgomery ladder maintains a pair of points whose u-difference is the base point, applying differential addition and doubling so that after processing the bits of k the first register holds k times the input point. Scalar multiplication on a group is commutative, so (a*b)P = (b*a)P and both parties derive the same u-coordinate. The companion test checks the ladder against brute-force affine point arithmetic.",
        complexityRationale:
            "The loop runs once per bit of the scalar and each iteration does a constant number of field operations, so time is O(log k). Recording one register snapshot per bit uses O(log k) space.",
        uses: [
            "Elliptic-curve Diffie-Hellman in TLS and messaging (with the real 255-bit field)",
            "Key agreement in the Signal and WireGuard protocols",
            "A teaching model for constant-time ladder arithmetic",
        ],
        references: [
            "RFC 7748: Elliptic Curves for Security, 2016",
            "Montgomery, Speeding the Pollard and Elliptic Curve Methods of Factorization, 1987",
        ],
        workedExample:
            "With base u = 2 modulo 1019, Alice's secret 5 gives public u(5P) and Bob's secret 7 gives u(7P). Alice computes u(5 * 7P) and Bob computes u(7 * 5P); both obtain the same shared u-coordinate, confirming the exchange.",
    },
    id: "x25519-key-exchange",
    name: "X25519 Key Exchange",
    category: "cryptography-security",
    complexity: { time: "O(log k)", space: "O(log k)" },
    defaultInput: { aliceSecret: 5, bobSecret: 7, baseU: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "fix a public prime, curve constant, and base point",
        "each party picks a secret scalar",
        "for each scalar bit run one ladder differential step",
        "conditionally swap the working registers",
        "publish the resulting public u-coordinate",
        "multiply the other party's public value by your secret",
        "both sides obtain the same shared u-coordinate",
        "done: report the agreed shared value",
    ],
};

export default module;

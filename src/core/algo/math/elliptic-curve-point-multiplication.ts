/**
 * elliptic-curve-point-multiplication.ts - Elliptic Curve Scalar Multiplication
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Scalar multiplication computes k times a point P on an elliptic curve over a
 * prime field. The left-to-right double-and-add method scans the binary digits
 * of k from most significant to least significant: for every bit it doubles the
 * running accumulator and, when the bit is one, adds the base point. Because
 * doubling and addition are the group operations of the curve, the result after
 * all bits is exactly kP, computed in logarithmic rather than linear time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log k) point additions on the curve
 *   Space: O(log k) for the binary expansion of the scalar
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The base point P is drawn at its curve coordinates.
 *   - The accumulator R is drawn at its current coordinates after each bit.
 *   - The final frame marks R as the answer kP.
 *   - meta carries the scalar, bit string, current bit, and resulting point.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A point in affine coordinates, or null for the point at infinity. */
type ECPoint = { x: number; y: number } | null;

interface Curve {
    p: number;
    a: number;
    b: number;
}

const DEFAULT_CURVE: Curve = { p: 17, a: 2, b: 2 };

/** Reduce an integer into the field [0, p). */
function mod(value: number, p: number): number {
    return ((value % p) + p) % p;
}

/** Modular inverse by brute force; the demo field is tiny so this is instant. */
function modInverse(value: number, p: number): number {
    const reduced = mod(value, p);
    for (let candidate = 1; candidate < p; candidate += 1) {
        if ((reduced * candidate) % p === 1) {
            return candidate;
        }
    }
    return 0;
}

/** Test the curve equation y^2 = x^3 + a x + b over F_p. */
function onCurve(point: NonNullable<ECPoint>, curve: Curve): boolean {
    const { x, y } = point;
    const { p, a, b } = curve;
    return mod(y * y, p) === mod(x * x * x + a * x + b, p);
}

/** Add two curve points using the chord-and-tangent group law. */
function pointAdd(left: ECPoint, right: ECPoint, curve: Curve): ECPoint {
    const { p, a } = curve;
    if (left === null) {
        return right;
    }
    if (right === null) {
        return left;
    }
    if (left.x === right.x && mod(left.y + right.y, p) === 0) {
        return null;
    }
    let slope: number;
    if (left.x === right.x && left.y === right.y) {
        const denominator = mod(2 * left.y, p);
        if (denominator === 0) {
            return null;
        }
        slope = mod((3 * left.x * left.x + a) * modInverse(denominator, p), p);
    } else {
        const denominator = mod(right.x - left.x, p);
        if (denominator === 0) {
            return null;
        }
        slope = mod((right.y - left.y) * modInverse(denominator, p), p);
    }
    const rx = mod(slope * slope - left.x - right.x, p);
    const ry = mod(slope * (left.x - rx) - left.y, p);
    return { x: rx, y: ry };
}

/** Human-readable label for a point or the point at infinity. */
function pointLabel(point: ECPoint): string {
    return point === null ? "O" : `(${point.x},${point.y})`;
}

/** Build a node entity for a curve point. */
function makeNode(id: string, label: string, point: ECPoint, state: EntityState): VisualEntity {
    if (point === null) {
        return {
            id,
            type: "node" as const,
            label,
            value: "point at infinity",
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: id, infinity: true },
        };
    }
    return {
        id,
        type: "node" as const,
        label,
        value: [point.x, point.y],
        state,
        x: point.x * 30,
        y: -point.y * 30,
        width: 0,
        height: 0,
        metadata: { role: id, x: point.x, y: point.y },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        k?: number;
        px?: number;
        py?: number;
        p?: number;
        a?: number;
        b?: number;
    } | null) ?? {};
    const curve: Curve = {
        p: typeof task.p === "number" ? Math.trunc(task.p) : DEFAULT_CURVE.p,
        a: typeof task.a === "number" ? Math.trunc(task.a) : DEFAULT_CURVE.a,
        b: typeof task.b === "number" ? Math.trunc(task.b) : DEFAULT_CURVE.b,
    };
    const scalar = typeof task.k === "number" ? Math.max(0, Math.trunc(task.k)) : 13;
    const px = typeof task.px === "number" ? Math.trunc(task.px) : 5;
    const py = typeof task.py === "number" ? Math.trunc(task.py) : 1;
    const base: ECPoint = { x: mod(px, curve.p), y: mod(py, curve.p) };
    let step = 0;

    if (curve.p < 3 || !onCurve(base, curve)) {
        yield {
            stepNumber: step,
            entities: [makeNode("base", "P", null, "error")],
            edges: [],
            description: "The base point is not on the curve, so scalar multiplication cannot proceed.",
            codeLineNumber: 0,
            layout: "point",
            meta: { k: scalar, valid: false },
        };
        return;
    }

    const bits = scalar.toString(2);
    yield {
        stepNumber: step,
        entities: [makeNode("base", `P${pointLabel(base)}`, base, "idle")],
        edges: [],
        description: `Computing ${scalar} times the point P${pointLabel(base)} on y^2 = x^3 + ${curve.a}x + ${curve.b} over F_${curve.p}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { k: scalar, bits, p: curve.p, valid: true },
    };
    step += 1;

    if (scalar === 0) {
        yield {
            stepNumber: step,
            entities: [
                makeNode("base", `P${pointLabel(base)}`, base, "idle"),
                makeNode("result", "0P = O", null, "sorted"),
            ],
            edges: [],
            description: "Zero times any point is the point at infinity.",
            codeLineNumber: 5,
            layout: "point",
            meta: { k: scalar, bits, resultX: -1, resultY: -1, infinity: true },
        };
        return;
    }

    let accumulator: ECPoint = null;
    for (let bitIndex = 0; bitIndex < bits.length; bitIndex += 1) {
        const bit = bits[bitIndex] === "1" ? 1 : 0;
        const doubled = pointAdd(accumulator, accumulator, curve);
        accumulator = bit === 1 ? pointAdd(doubled, base, curve) : doubled;
        yield {
            stepNumber: step,
            entities: [
                makeNode("base", `P${pointLabel(base)}`, base, "idle"),
                makeNode("acc", `R = ${pointLabel(accumulator)}`, accumulator, "active"),
            ],
            edges: [],
            description: `Bit ${bitIndex + 1} of ${bits} is ${bit}: doubled the accumulator${bit === 1 ? " and added P" : ""}, giving R = ${pointLabel(accumulator)}.`,
            codeLineNumber: bit === 1 ? 4 : 3,
            layout: "point",
            meta: {
                k: scalar,
                bits,
                bitIndex,
                bit,
                doubled: pointLabel(doubled),
                result: pointLabel(accumulator),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: [
            makeNode("base", `P${pointLabel(base)}`, base, "idle"),
            makeNode("result", `${scalar}P = ${pointLabel(accumulator)}`, accumulator, "sorted"),
        ],
        edges: [],
        description: `Done: ${scalar}P = ${pointLabel(accumulator)} on the curve over F_${curve.p}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            k: scalar,
            bits,
            resultX: accumulator?.x ?? -1,
            resultY: accumulator?.y ?? -1,
            infinity: accumulator === null,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Multiplying a point by a large integer means adding it to itself many times, which would be far too slow. Instead, write the integer in binary and walk its bits from left to right, doubling the running point at each step and adding the original point only when the bit is one. A few dozen doublings replace billions of additions, which is why elliptic curve cryptography is practical.",
        invariants: [
            "After each bit the accumulator equals the value of the bits processed so far times the base point.",
            "Doubling and addition are the curve group law, so every intermediate point satisfies the curve equation.",
            "The point at infinity acts as zero and as the identity of addition.",
        ],
        correctness:
            "Write k as the sum of powers of two selected by its one bits. The left-to-right scan maintains the invariant that the accumulator is the partial binary prefix interpreted as a scalar times P. Doubling advances that prefix by one binary place, and adding P when the bit is one incorporates the new low bit. After the last bit the prefix is k, so the accumulator is kP; the group law is associative, so the sequence of doublings and additions composes correctly.",
        complexityRationale:
            "A k-bit scalar has O(log k) binary digits, and each digit costs one point doubling plus at most one point addition, so the time is O(log k) curve operations. The bit string needs O(log k) space while the running point uses constant space.",
        uses: [
            "Scalar multiplication in elliptic curve key exchange and signatures",
            "Deriving public keys from private scalars in ECDSA and EdDSA",
            "Fast arithmetic in any abelian group with an efficient doubling operation",
        ],
        references: [
            "Silverman, The Arithmetic of Elliptic Curves, Chapter 1",
            "Hankerson, Menezes and Vanstone, Guide to Elliptic Curve Cryptography, Chapter 3",
        ],
        workedExample:
            "On y^2 = x^3 + 2x + 2 over F_17 with P = (5,1), the scalar 13 has binary digits 1101. Doubling and adding along those bits gives 13P = (16,4), which still satisfies the curve equation; a brute-force sum of thirteen copies of P gives the same point.",
    },
    id: "elliptic-curve-point-multiplication",
    name: "Elliptic Curve Point Multiplication",
    category: "math",
    complexity: { time: "O(log k)", space: "O(log k)" },
    defaultInput: { k: 13, px: 5, py: 1, p: 17, a: 2, b: 2 },
    visualType: "point",
    run,
    pseudocode: [
        "parse the scalar k and the base point P on the curve",
        "write k in binary and set the accumulator R to infinity",
        "for each bit of k from most significant to least significant",
        "double the accumulator, setting R to R plus R",
        "if the bit is one, add the base point, setting R to R plus P",
        "a zero scalar returns the point at infinity",
        "done: report R as k times P on the curve",
    ],
};

export default module;

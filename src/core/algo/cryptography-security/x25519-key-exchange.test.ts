/**
 * x25519-key-exchange.test.ts - Brute-force affine cross-check, DH agreement, frame shape.
 */

import { describe, expect, it } from "vitest";
import mod, { A, A24, BASE_U, P, xmul } from "./x25519-key-exchange";
import type { VisualFrame } from "@/types";

const modP = (x: bigint): bigint => ((x % P) + P) % P;

function powMod(base: bigint, exponent: bigint): bigint {
    let result = 1n;
    let b = modP(base);
    let e = exponent;
    while (e > 0n) {
        if (e & 1n) {
            result = modP(result * b);
        }
        b = modP(b * b);
        e >>= 1n;
    }
    return result;
}
const inv = (x: bigint): bigint => powMod(x, P - 2n);

type Point = [bigint, bigint] | null;

/** Affine Montgomery doubling from the curve equation. */
function dbl(point: Point): Point {
    if (point === null) {
        return null;
    }
    const [u, v] = point;
    if (v === 0n) {
        return null;
    }
    const lambda = modP((3n * u * u + 2n * A * u + 1n) * inv(2n * v));
    const u2 = modP(lambda * lambda - A - 2n * u);
    const v2 = modP(lambda * (u - u2) - v);
    return [u2, v2];
}

/** Affine Montgomery addition from the curve equation. */
function add(left: Point, right: Point): Point {
    if (left === null) {
        return right;
    }
    if (right === null) {
        return left;
    }
    const [u1, v1] = left;
    const [u2, v2] = right;
    if (u1 === u2) {
        return modP(v1 + v2) === 0n ? null : dbl(left);
    }
    const lambda = modP((v2 - v1) * inv(u2 - u1));
    const u3 = modP(lambda * lambda - A - u1 - u2);
    const v3 = modP(lambda * (u1 - u3) - v1);
    return [u3, v3];
}

/** Brute-force affine scalar multiplication. */
function mul(scalar: number, point: Point): Point {
    let result: Point = null;
    let current = point;
    let k = scalar;
    while (k > 0) {
        if (k & 1) {
            result = add(result, current);
        }
        current = dbl(current);
        k >>= 1;
    }
    return result;
}

/** Recover an affine point from its u-coordinate using the curve equation. */
function pointFromU(u: bigint): Point {
    const rhs = modP(u * u * u + A * u * u + u);
    if (powMod(rhs, (P - 1n) / 2n) !== 1n) {
        return null;
    }
    return [u, powMod(rhs, (P + 1n) / 4n)];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(16);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(8);
        expect(frame.meta["cols"]).toBe(2);
        expect(frame.meta["p"]).toBe(1019);
        expect(frame.meta["a24"]).toBe(764);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("X25519 Key Exchange", () => {
    it("uses the published ladder constant", () => {
        expect(A24).toBe(modP((A - 2n) * inv(4n)));
        expect(BASE_U).toBe(2n);
    });

    it("matches brute-force affine multiplication for many scalars", () => {
        for (const u of [2n, 5n, 9n, 10n]) {
            const point = pointFromU(u);
            expect(point).not.toBeNull();
            for (let k = 1; k <= 25; k += 1) {
                const affine = mul(k, point);
                expect(affine).not.toBeNull();
                expect(xmul(k, u)).toBe(affine![0]);
            }
        }
    });

    it("keeps Alice and Bob's shared secret equal", () => {
        for (const [alice, bob] of [
            [5, 7],
            [13, 11],
            [19, 23],
        ]) {
            const frames = [...mod.run({ aliceSecret: alice, bobSecret: bob, baseU: 2 })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["agreed"]).toBe(true);
            expect(final?.["aliceShared"]).toBe(final?.["bobShared"]);
            const pubA = xmul(alice, BASE_U);
            const pubB = xmul(bob, BASE_U);
            expect(BigInt(Number(final?.["alicePublic"]))).toBe(pubA);
            expect(BigInt(Number(final?.["bobPublic"]))).toBe(pubB);
            expect(BigInt(Number(final?.["aliceShared"]))).toBe(xmul(bob, pubA));
            expect(BigInt(Number(final?.["bobShared"]))).toBe(xmul(alice, pubB));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

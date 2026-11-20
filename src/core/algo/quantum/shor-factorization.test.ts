/**
 * shor-factorization.test.ts - Order and gcd checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { gcd, powMod, shorToy } from "./shor-factorization";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], bars: number): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(bars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Naive repeated multiplication, independent of powMod. */
function naivePower(base: number, exponent: number, modulus: number): number {
    let value = 1 % modulus;
    for (let i = 0; i < exponent; i += 1) value = (value * base) % modulus;
    return value;
}

describe("Shor Factorization (Toy)", () => {
    it("agrees with naive modular exponentiation and gcd", () => {
        for (let base = 1; base <= 12; base += 1) {
            for (let exponent = 0; exponent <= 10; exponent += 1) {
                expect(powMod(base, exponent, 35)).toBe(naivePower(base, exponent, 35));
            }
        }
        expect(gcd(12, 18)).toBe(6);
        expect(gcd(13, 17)).toBe(1);
        expect(gcd(0, 9)).toBe(9);
    });

    it("finds the exact order and a valid factor pair for coprime bases", () => {
        for (const n of [15, 21, 35, 9, 25]) {
            for (let a = 2; a < n; a += 1) {
                if (gcd(a, n) !== 1) continue;
                const data = shorToy(n, a);
                let expectedOrder = 0;
                for (let x = 1; x <= n; x += 1) {
                    if (naivePower(a, x, n) === 1) {
                        expectedOrder = x;
                        break;
                    }
                }
                expect(data.order).toBe(expectedOrder);
                expect(naivePower(a, data.order, n)).toBe(1);
                expect(data.sequence.length).toBe(data.order);
                for (let x = 0; x < data.order; x += 1) {
                    expect(data.sequence[x]).toBe(naivePower(a, x, n));
                    expect(data.sequence[x]).toBe(naivePower(a, x + data.order, n));
                }
                const canSplit = data.order % 2 === 0 && data.halfPower !== n - 1;
                if (data.success) {
                    expect(canSplit).toBe(true);
                    expect(data.factors).not.toBeNull();
                    expect(data.factors![0]! * data.factors![1]!).toBe(n);
                    expect(data.factors![0]!).toBeGreaterThan(1);
                    expect(data.factors![1]!).toBeLessThan(n);
                } else {
                    expect(data.factors).toBeNull();
                }
                const frames = [...mod.run({ n, a })];
                checkFrames(frames, data.sequence.length);
            }
        }
    });

    it("factors the default input and terminates cleanly", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 4);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["order"]).toBe(4);
        expect(final?.["halfPower"]).toBe(4);
        expect(final?.["factors"]).toEqual([3, 5]);
        expect(final?.["success"]).toBe(true);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});

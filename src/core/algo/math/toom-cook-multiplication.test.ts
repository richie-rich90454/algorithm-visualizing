/** toom-cook-multiplication.test.ts - Exact product checked against BigInt reference. */

import { describe, expect, it } from "vitest";
import mod, { evaluate, splitLimbs, toomCookProduct } from "./toom-cook-multiplication";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Toom-Cook multiplication", () => {
    it("splits and evaluates limbs consistently", () => {
        const base = 100n;
        const limbs = splitLimbs(12345n, base);
        expect(limbs).toEqual([45n, 23n, 1n]);
        expect(evaluate(limbs, base)).toBe(12345n);
    });

    it("multiplies correctly across many random inputs", () => {
        for (let trial = 0; trial < 60; trial += 1) {
            const a = BigInt(Math.floor(Math.random() * 1_000_000_000_000));
            const b = BigInt(Math.floor(Math.random() * 1_000_000_000_000));
            expect(toomCookProduct(a, b)).toBe(a * b);
        }
        expect(toomCookProduct(0n, 987n)).toBe(0n);
        expect(toomCookProduct(123456789012345n, 99999999999n)).toBe(123456789012345n * 99999999999n);
    });

    it("emits well-formed frames and terminates with the exact product", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["product"]).toBe((12345678n * 87654321n).toString());
        expect(generator.next().done).toBe(true);
    });
});

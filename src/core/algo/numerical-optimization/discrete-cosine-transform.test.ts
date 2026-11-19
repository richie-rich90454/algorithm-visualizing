/**
 * discrete-cosine-transform.test.ts - Reference transform, inverse round trip, Parseval, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./discrete-cosine-transform";
import type { VisualFrame } from "@/types";

function referenceForward(x: number[]): number[] {
    const size = x.length;
    return Array.from({ length: size }, (_, k) => {
        let sum = 0;
        for (let n = 0; n < size; n += 1) sum += x[n]! * Math.cos((Math.PI * (n + 0.5) * k) / size);
        return sum;
    });
}

function referenceInverse(coefficients: number[]): number[] {
    const size = coefficients.length;
    return Array.from({ length: size }, (_, n) => {
        let sum = coefficients[0]! / 2;
        for (let k = 1; k < size; k += 1) sum += coefficients[k]! * Math.cos((Math.PI * (n + 0.5) * k) / size);
        return (2 / size) * sum;
    });
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["n"]).toBe(n);
        expect((frame.meta["coefficients"] as number[]).length).toBe(n);
        expect((frame.meta["reconstructed"] as number[]).length).toBe(n);
    });
}

describe("DiscreteCosineTransform", () => {
    it("matches an independent direct DCT-II and inverse DCT-III", () => {
        const cases = [
            [1, 2, 3, 4, 4, 3, 2, 1],
            [3, -1],
            [0, 0, 0, 0],
            [-2, 7, 1.5, -0.25, 3],
        ];
        for (const x of cases) {
            const frames = [...mod.run({ x })];
            checkFrames(frames, x.length);
            const final = frames[frames.length - 1]?.meta;
            const expected = referenceForward(x);
            expected.forEach((value, i) => {
                expect((final?.["coefficients"] as number[])[i]).toBeCloseTo(value, 11);
            });
            referenceInverse(expected).forEach((value, i) => {
                expect((final?.["reconstructed"] as number[])[i]).toBeCloseTo(value, 11);
            });
            expect(final?.["roundTripError"] as number).toBeLessThan(1e-10);
        }
    });

    it("satisfies the DC and Parseval properties", () => {
        const x = [1, 2, 3, 4, 4, 3, 2, 1];
        const final = [...mod.run({ x })].pop()?.meta;
        const coefficients = final?.["coefficients"] as number[];
        expect(coefficients[0]).toBeCloseTo(x.reduce((a, b) => a + b, 0), 11);
        const energy = x.reduce((sum, v) => sum + v * v, 0);
        const spectral = (2 / x.length) * (coefficients[0]! ** 2 / 2 + coefficients.slice(1).reduce((sum, v) => sum + v * v, 0));
        expect(spectral).toBeCloseTo(energy, 10);
    });

    it("maps an impulse to the cosine basis row", () => {
        const x = [1, 0, 0, 0, 0, 0, 0, 0];
        const final = [...mod.run({ x })].pop()?.meta;
        (final?.["coefficients"] as number[]).forEach((value, k) => {
            expect(value).toBeCloseTo(Math.cos((Math.PI * k) / (2 * x.length)), 11);
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});

/** gelu-activation.test.ts - Independent normal-CDF integration, identity, derivative, and frames. */

import { describe, expect, it } from "vitest";
import mod, { erf, geluFor, normalCdf } from "./gelu-activation";
import type { VisualFrame } from "@/types";

interface Input {
    values: number[];
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBe(rows + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Integrate the standard normal density from 0 to x with Simpson's rule. */
function normalCdfReference(x: number): number {
    const n = 2000;
    const h = x / n;
    const density = (t: number) => Math.exp(-0.5 * t * t) / Math.sqrt(2 * Math.PI);
    let sum = density(0) + density(x);
    for (let i = 1; i < n; i += 1) {
        sum += (i % 2 === 0 ? 2 : 4) * density(i * h);
    }
    return 0.5 + (sum * h) / 3;
}

describe("GELU Activation", () => {
    const input = mod.defaultInput as Input;

    it("matches an independently integrated normal CDF", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.values.length);
        const got = frames[frames.length - 1]?.meta["values"] as number[];
        input.values.forEach((x, i) => {
            expect(normalCdf(x)).toBeCloseTo(normalCdfReference(x), 6);
            expect(got[i]).toBeCloseTo(x * normalCdfReference(x), 5);
        });
    });

    it("satisfies the reflection identity and the erf symmetry", () => {
        for (const x of [0.3, 1, 2, 3]) {
            expect(geluFor(x).value - geluFor(-x).value).toBeCloseTo(x, 5);
        }
        expect(erf(0)).toBeCloseTo(0, 12);
        expect(erf(1)).toBeCloseTo(-erf(-1), 12);
        expect(erf(4)).toBeGreaterThan(0.999);
    });

    it("has a derivative consistent with finite differences", () => {
        const h = 1e-5;
        for (const x of [-2, -0.5, 0, 0.7, 2]) {
            const finiteDifference = (geluFor(x + h).value - geluFor(x - h).value) / (2 * h);
            expect(geluFor(x).derivative).toBeCloseTo(finiteDifference, 4);
        }
        expect(geluFor(0).value).toBeCloseTo(0, 12);
        expect(geluFor(5).value).toBeCloseTo(5, 4);
        expect(geluFor(-5).value).toBeCloseTo(0, 4);
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

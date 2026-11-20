/**
 * mirror-descent.test.ts - Entropic mirror descent correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./mirror-descent";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Closed-form softmax outcome after T multiplicative steps. */
function referenceSoftmax(loss: number[], eta: number, steps: number): number[] {
    const exps = loss.map((c) => Math.exp(-steps * eta * c));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
}

describe("Mirror Descent", () => {
    it("matches the closed-form softmax of the constant loss", () => {
        const loss = [1, 2, 0.5, 3];
        const eta = 0.2;
        const steps = 25;
        const frames = [...mod.run({ loss, eta, steps })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta["x"] as number[];
        const expected = referenceSoftmax(loss, eta, steps);
        final.forEach((v, i) => expect(v).toBeCloseTo(expected[i] as number, 10));
    });

    it("keeps every iterate on the probability simplex", () => {
        const frames = [...mod.run({ loss: [3, -1, 0, 2], eta: 0.35, steps: 30 })];
        for (const frame of frames) {
            const x = frame.meta["x"] as number[];
            if (!x) {
                continue;
            }
            expect(x.every((v) => v >= 0)).toBe(true);
            expect(x.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
        }
    });

    it("concentrates mass on the lowest loss coordinate", () => {
        const loss = [5, 4, 1, 9];
        const frames = [...mod.run({ loss, eta: 0.5, steps: 80 })];
        const final = frames[frames.length - 1]?.meta["x"] as number[];
        const largestIndex = final.indexOf(Math.max(...final));
        expect(largestIndex).toBe(loss.indexOf(Math.min(...loss)));
        expect(final[largestIndex] as number).toBeGreaterThan(0.9);
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

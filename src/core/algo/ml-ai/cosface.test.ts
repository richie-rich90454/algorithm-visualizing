/** cosface.test.ts - Independent cosine-margin reference, margin properties, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { cosfaceLogit, normalize } from "./cosface";
import type { VisualFrame } from "@/types";

interface Input {
    feature: number[];
    weight: number[];
    scale: number;
    margin: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("CosFace", () => {
    it("matches an independent normalized-cosine reference", () => {
        const cases: Array<[number[], number[], number, number]> = [
            [[2, 1, 0.5], [1, 1, 0], 10, 0.35],
            [[1, 0], [0, 1], 20, 0.2],
            [[3, 4], [4, 3], 5, 0.1],
        ];
        for (const [f, w, s, m] of cases) {
            const got = cosfaceLogit(f, w, s, m);
            const fn = Math.sqrt(f.reduce((a, b) => a + b * b, 0));
            const wn = Math.sqrt(w.reduce((a, b) => a + b * b, 0));
            const dot = f.reduce((a, b, i) => a + b * w[i]!, 0);
            const cos = Math.max(-1, Math.min(1, dot / (fn * wn)));
            expect(close(got.cosTheta, cos)).toBe(true);
            expect(close(got.shifted, cos - m)).toBe(true);
            expect(close(got.logit, s * (cos - m))).toBe(true);
        }
    });

    it("the margin lowers the logit linearly and scale multiplies it", () => {
        const zero = cosfaceLogit([1, 0], [1, 0], 10, 0);
        const margined = cosfaceLogit([1, 0], [1, 0], 10, 0.3);
        expect(close(zero.logit - margined.logit, 3)).toBe(true);
        const doubled = cosfaceLogit([1, 0], [1, 0], 20, 0.3);
        expect(close(doubled.logit, 2 * margined.logit)).toBe(true);
    });

    it("normalization produces unit length and clamps a zero vector safely", () => {
        const unit = normalize([1, 2, 2]);
        expect(close(Math.sqrt(unit.reduce((s, v) => s + v * v, 0)), 1)).toBe(true);
        expect(normalize([0, 0])).toEqual([0, 0]);
        expect(Number.isFinite(cosfaceLogit([0, 0], [1, 0], 10, 0.3).logit)).toBe(true);
    });

    it("matches the reference through the module run metadata", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = cosfaceLogit(input.feature, input.weight, input.scale, input.margin);
        const final = frames[frames.length - 1]?.meta;
        expect(close(final?.["cosTheta"] as number, expected.cosTheta)).toBe(true);
        expect(close(final?.["shifted"] as number, expected.shifted)).toBe(true);
        expect(close(final?.["logit"] as number, expected.logit)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(3);
        expect(generator.next().done).toBe(true);
    });
});

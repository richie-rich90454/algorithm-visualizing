/** arcface.test.ts - Independent angular-margin reference, monotonicity, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { arcfaceLogit, normalize } from "./arcface";
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

describe("ArcFace", () => {
    it("matches an independent arccos-based reference", () => {
        const cases: Array<[number[], number[], number, number]> = [
            [[2, 1, 0.5], [1, 1, 0], 10, 0.5],
            [[1, 0], [0, 1], 20, 0.3],
            [[3, 4], [4, 3], 5, 0.2],
            [[1, 1], [2, 2], 30, 0.6],
        ];
        for (const [f, w, s, m] of cases) {
            const got = arcfaceLogit(f, w, s, m);
            const fn = Math.sqrt(f.reduce((a, b) => a + b * b, 0));
            const wn = Math.sqrt(w.reduce((a, b) => a + b * b, 0));
            let dot = 0;
            for (let i = 0; i < f.length; i += 1) dot += f[i]! * w[i]!;
            const cosTheta = Math.max(-1, Math.min(1, dot / (fn * wn)));
            const theta = Math.acos(cosTheta);
            const expectedShifted = Math.cos(theta + m);
            expect(close(got.cosTheta, cosTheta)).toBe(true);
            expect(close(got.theta, theta)).toBe(true);
            expect(close(got.shifted, expectedShifted)).toBe(true);
            expect(close(got.logit, s * expectedShifted)).toBe(true);
        }
    });

    it("a positive margin lowers the target logit and normalization yields unit length", () => {
        const base = arcfaceLogit([2, 1, 0.5], [1, 1, 0], 10, 0);
        const margin = arcfaceLogit([2, 1, 0.5], [1, 1, 0], 10, 0.5);
        expect(margin.logit).toBeLessThan(base.logit);
        const unit = normalize([3, 4]);
        expect(close(Math.sqrt(unit.reduce((s, v) => s + v * v, 0)), 1)).toBe(true);
        expect(normalize([0, 0])).toEqual([0, 0]);
    });

    it("larger angles give smaller target logits over the valid range", () => {
        let previous = Infinity;
        for (let i = 0; i <= 20; i += 1) {
            const angle = (i / 20) * (Math.PI - 0.6);
            const feature = [Math.cos(angle), Math.sin(angle)];
            const logit = arcfaceLogit(feature, [1, 0], 10, 0.5).logit;
            expect(logit).toBeLessThanOrEqual(previous + 1e-9);
            previous = logit;
        }
    });

    it("matches the reference through the module run metadata", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = arcfaceLogit(input.feature, input.weight, input.scale, input.margin);
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

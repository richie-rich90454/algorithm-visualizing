/** gaussian-process-regression.test.ts - Independent GP solve and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./gaussian-process-regression";
import type { VisualFrame } from "@/types";

interface Input {
    x: number[];
    y: number[];
    testX: number[];
    lengthscale: number;
    amplitude: number;
    noise: number;
}

function invert(m: number[][]): number[][] {
    const n = m.length;
    const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_u, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < n; c += 1) {
        let p = c;
        for (let r = c + 1; r < n; r += 1) if (Math.abs(a[r]?.[c] ?? 0) > Math.abs(a[p]?.[c] ?? 0)) p = r;
        [a[c], a[p]] = [a[p]!, a[c]!];
        const pv = a[c]?.[c] ?? 0;
        for (let j = 0; j < 2 * n; j += 1) a[c]![j] = (a[c]![j] ?? 0) / pv;
        for (let r = 0; r < n; r += 1) {
            if (r === c) continue;
            const f = a[r]?.[c] ?? 0;
            for (let j = 0; j < 2 * n; j += 1) a[r]![j] = (a[r]![j] ?? 0) - f * (a[c]![j] ?? 0);
        }
    }
    return a.map((row) => row.slice(n));
}

function reference(input: Input) {
    const n = Math.min(input.x.length, input.y.length);
    const k = input.x.slice(0, n).map((xi, i) =>
        input.x.slice(0, n).map((xj, j) => {
            const d = xi - xj;
            return input.amplitude ** 2 * Math.exp(-(d * d) / (2 * input.lengthscale ** 2)) + (i === j ? input.noise ** 2 : 0);
        }),
    );
    const kInv = invert(k);
    const alpha = kInv.map((row) => row.reduce((s, v, j) => s + v * (input.y[j] ?? 0), 0));
    const means = input.testX.map((at) => {
        const kStar = input.x.slice(0, n).map((xi) => {
            const d = at - xi;
            return input.amplitude ** 2 * Math.exp(-(d * d) / (2 * input.lengthscale ** 2));
        });
        return kStar.reduce((s, v, i) => s + v * (alpha[i] ?? 0), 0);
    });
    const reconstruct = k.map((row) => row.reduce((s, v, j) => s + v * (alpha[j] ?? 0), 0));
    return { k, kInv, alpha, means, reconstruct };
}

function checkFrames(frames: VisualFrame[], input: Input): void {
    const n = Math.min(input.x.length, input.y.length);
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout === "grid" || frame.layout === "point").toBe(true);
        if (frame.layout === "grid") expect(frame.entities.length).toBe(n * n);
        else expect(frame.entities.length).toBeGreaterThanOrEqual(n);
        expect(frame.entities.every((e) => e.id.length > 0)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Gaussian process regression", () => {
    const input = mod.defaultInput as Input;

    it("matches an independently solved posterior mean", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const preds = final?.["predictions"] as number[];
        expect(preds.length).toBe(expected.means.length);
        preds.forEach((value, i) => expect(value).toBeCloseTo(expected.means[i] ?? 0, 8));
        expected.reconstruct.forEach((value, i) => expect(value).toBeCloseTo(input.y[i] ?? 0, 6));
    });

    it("interpolates observations within a few noise levels", () => {
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        const errors = final?.["trainingErrors"] as number[];
        expect(errors.every((error) => error < 3 * input.noise)).toBe(true);
        const variances = final?.["variances"] as number[];
        expect(variances.every((v) => v >= 0)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

/**
 * quantum-fourier-transform.test.ts - Brute-force DFT, Parseval, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-fourier-transform";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent direct DFT with explicit cosine and sine sums. */
function dft(input: number[]): { re: number[]; im: number[] } {
    const n = input.length;
    const scale = 1 / Math.sqrt(n);
    const re = new Array<number>(n).fill(0);
    const im = new Array<number>(n).fill(0);
    for (let k = 0; k < n; k += 1) {
        for (let j = 0; j < n; j += 1) {
            const angle = (2 * Math.PI * j * k) / n;
            re[k] = (re[k] ?? 0) + scale * (input[j] ?? 0) * Math.cos(angle);
            im[k] = (im[k] ?? 0) + scale * (input[j] ?? 0) * Math.sin(angle);
        }
    }
    return { re, im };
}

describe("QuantumFourierTransform", () => {
    it("matches a brute-force DFT for several small registers", () => {
        const inputs = [
            [1, 0, 0, 0],
            [0, 0, 1, 0],
            [0.5, 0.5, 0.5, 0.5],
            [0.6, 0.8, 0, 0],
            [1, 0, 0, 0, 0, 0, 0, 0],
        ];
        for (const amplitudes of inputs) {
            const frames = [...mod.run({ amplitudes })];
            checkFrames(frames, amplitudes.length);
            const final = frames[frames.length - 1]?.meta;
            const re = final?.["re"] as number[];
            const im = final?.["im"] as number[];
            const expected = dft(amplitudes);
            for (let k = 0; k < amplitudes.length; k += 1) {
                expect(re[k]).toBeCloseTo(expected.re[k] ?? 0, 10);
                expect(im[k]).toBeCloseTo(expected.im[k] ?? 0, 10);
            }
        }
    });

    it("preserves total probability (Parseval)", () => {
        const amplitudes = [0.5, 0.5, 0.5, 0.5];
        const frames = [...mod.run({ amplitudes })];
        checkFrames(frames, 4);
        const final = frames[frames.length - 1]?.meta;
        const re = final?.["re"] as number[];
        const im = final?.["im"] as number[];
        const inputNorm = amplitudes.reduce((sum, a) => sum + a * a, 0);
        const outputNorm = re.reduce((sum, v, i) => sum + v * v + (im[i] ?? 0) ** 2, 0);
        expect(outputNorm).toBeCloseTo(inputNorm, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});

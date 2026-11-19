/** bluestein-fft.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./bluestein-fft";
import type { VisualFrame } from "@/types";

/** Direct O(N^2) DFT used as an independent reference. */
function directDFT(signal: number[]): Array<{ re: number; im: number }> {
    const n = signal.length;
    return Array.from({ length: n }, (_, k) => {
        let re = 0;
        let im = 0;
        for (let t = 0; t < n; t += 1) {
            const angle = (-2 * Math.PI * t * k) / n;
            re += signal[t]! * Math.cos(angle);
            im += signal[t]! * Math.sin(angle);
        }
        return { re, im };
    });
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) {
            expect(Number.isFinite(entity.value as number)).toBe(true);
        }
    });
}

describe("Bluestein FFT", () => {
    it("matches a direct DFT for prime and composite non-power-of-two lengths", () => {
        const signals: number[][] = [
            [1, 0, 0, 0, 0],
            [1, 2, 3, 4, 5, 6, 7],
            [0, 1, 0, -1, 0, 1, 0, -1, 0, 1],
            [3, -1, 4, -1, 5, -9, 2, 6, -5, 3, 5, -8, 9],
            [1, 1, 1, 1, 0, 0, 0, 0],
        ];
        for (const signal of signals) {
            const frames = [...mod.run({ signal })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const real = final?.["real"] as number[];
            const imag = final?.["imag"] as number[];
            const expected = directDFT(signal);
            expect(real.length).toBe(signal.length);
            expect(imag.length).toBe(signal.length);
            for (let k = 0; k < signal.length; k += 1) {
                expect(real[k]!).toBeCloseTo(expected[k]!.re, 8);
                expect(imag[k]!).toBeCloseTo(expected[k]!.im, 8);
            }
        }
    });

    it("uses a padded length that is a power of two at least 2N-1", () => {
        for (const n of [3, 5, 7, 10, 13]) {
            const signal = Array.from({ length: n }, (_, i) => i + 1);
            const frames = [...mod.run({ signal })];
            const padded = frames[frames.length - 1]?.meta["paddedLength"] as number;
            expect((padded & (padded - 1)) === 0).toBe(true);
            expect(padded).toBeGreaterThanOrEqual(2 * n - 1);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

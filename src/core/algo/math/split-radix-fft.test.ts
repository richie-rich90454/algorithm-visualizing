/**
 * split-radix-fft.test.ts - Naive DFT cross-check, Parseval property,
 * frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./split-radix-fft";
import type { VisualFrame } from "@/types";

function naiveDft(values: number[]): Array<[number, number]> {
    const n = values.length;
    return Array.from({ length: n }, (_, k) => {
        let re = 0;
        let im = 0;
        for (let t = 0; t < n; t += 1) {
            const angle = (-2 * Math.PI * k * t) / n;
            re += values[t]! * Math.cos(angle);
            im += values[t]! * Math.sin(angle);
        }
        return [re, im] as [number, number];
    });
}

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["flatSpectrum"] as number[]).length % 2).toBe(0);
    });
}

describe("SplitRadixFft", () => {
    it("matches the naive DFT for several power-of-two lengths", () => {
        const cases: number[][] = [
            [5],
            [1, -1],
            [1, 2, 3, 4],
            [3, -2, 0, 7, 1, 4, -1, 2],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ];
        for (const values of cases) {
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const n = frames[0]!.meta["n"] as number;
            const expected = naiveDft(Array.from({ length: n }, (_, i) => values[i] ?? 0));
            const re = frames[frames.length - 1]!.meta["real"] as number[];
            const im = frames[frames.length - 1]!.meta["imag"] as number[];
            expect(re.length).toBe(n);
            for (let k = 0; k < n; k += 1) {
                expect(re[k]!).toBeCloseTo(expected[k]![0], 9);
                expect(im[k]!).toBeCloseTo(expected[k]![1], 9);
            }
        }
    });

    it("obeys Parseval's identity", () => {
        const values = [2, -1, 3, 0, 4, 5, -2, 1];
        const frames = [...mod.run({ values })];
        checkFrames(frames);
        const n = frames[0]!.meta["n"] as number;
        const timeEnergy = values.reduce((sum, v) => sum + v * v, 0);
        const spectrumEnergy = frames[frames.length - 1]!.meta["energy"] as number;
        expect(spectrumEnergy).toBeCloseTo(n * timeEnergy, 8);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});

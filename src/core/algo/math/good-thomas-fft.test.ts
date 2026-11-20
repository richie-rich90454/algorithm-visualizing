/** good-thomas-fft.test.ts - Naive DFT cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./good-thomas-fft";
import type { VisualFrame } from "@/types";

type C = [number, number];
function dft(values: number[]): C[] {
    const n = values.length;
    const out: C[] = [];
    for (let k = 0; k < n; k += 1) {
        let re = 0;
        let im = 0;
        for (let i = 0; i < n; i += 1) {
            re += values[i]! * Math.cos((-2 * Math.PI * k * i) / n);
            im += values[i]! * Math.sin((-2 * Math.PI * k * i) / n);
        }
        out.push([re, im]);
    }
    return out;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Good-Thomas FFT", () => {
    it("matches a naive DFT for coprime factor pairs", () => {
        const cases = [
            { values: [1, 2, 3, 4, 5, 6], n1: 2, n2: 3 },
            { values: [3, -1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9], n1: 3, n2: 5 },
            { values: [2, 0, -1, 3, 4, 1], n1: 3, n2: 2 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const got = (final["spectrum"] as string).split(";").map((s) => {
                const [re, im] = s.split(":").map(Number);
                return [re ?? 0, im ?? 0] as C;
            });
            const expected = dft(input.values);
            expect(got.length).toBe(expected.length);
            for (let i = 0; i < got.length; i += 1) {
                expect(got[i]![0]).toBeCloseTo(expected[i]![0], 5);
                expect(got[i]![1]).toBeCloseTo(expected[i]![1], 5);
            }
            expect(final["matchesNaiveDft"]).toBe(true);
        }
    });

    it("reports an invalid factorization without throwing", () => {
        const frames = [...mod.run({ values: [1, 2, 3, 4], n1: 3, n2: 3 })];
        expect(frames.length).toBe(1);
        expect(frames[0]!.meta["valid"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});

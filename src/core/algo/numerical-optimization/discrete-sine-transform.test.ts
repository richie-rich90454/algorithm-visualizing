/**
 * discrete-sine-transform.test.ts - Orthogonality, inverse/Parseval checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./discrete-sine-transform";
import type { VisualFrame } from "@/types";

/** Independent naive DST-I projection used as a reference. */
function naiveDst(signal: number[]): number[] {
    const n = signal.length;
    return Array.from({ length: n }, (_, k) =>
        signal.reduce((sum, v, i) => sum + v * Math.sin((Math.PI * (i + 1) * (k + 1)) / (n + 1)), 0),
    );
}

function naiveInverse(coefficients: number[]): number[] {
    const n = coefficients.length;
    return Array.from({ length: n }, (_, i) =>
        (2 / (n + 1)) *
        coefficients.reduce((sum, v, k) => sum + v * Math.sin((Math.PI * (i + 1) * (k + 1)) / (n + 1)), 0),
    );
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n);
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        frame.entities.forEach((e) => expect(Number.isFinite(e.value as number)).toBe(true));
    });
}

describe("DiscreteSineTransform", () => {
    it("matches an independent naive projection", () => {
        const signals = [
            [1, 2, 3, 4],
            [1, 0, 0, 0, 0],
            [0.5, -1, 2, -3, 4, 1, 0],
        ];
        for (const signal of signals) {
            const frames = [...mod.run({ signal })];
            checkFrames(frames, signal.length);
            const final = frames[frames.length - 1]?.meta;
            const expected = naiveDst(signal);
            (final?.["coefficients"] as number[]).forEach((value, i) => {
                expect(value).toBeCloseTo(expected[i]!, 10);
            });
        }
    });

    it("inverts exactly and satisfies Parseval's relation", () => {
        const signal = [2, -1, 3, 0, 4, -2];
        const frames = [...mod.run({ signal })];
        const final = frames[frames.length - 1]?.meta;
        const coefficients = final?.["coefficients"] as number[];
        const reconstructed = naiveInverse(coefficients);
        reconstructed.forEach((value, i) => expect(value).toBeCloseTo(signal[i]!, 9));
        expect(final?.["reconstructionError"] as number).toBeLessThan(1e-9);

        const n = signal.length;
        const signalEnergy = signal.reduce((s, v) => s + v * v, 0);
        const spectralEnergy = (2 / (n + 1)) * coefficients.reduce((s, v) => s + v * v, 0);
        expect(spectralEnergy).toBeCloseTo(signalEnergy, 9);
    });

    it("produces an impulse response equal to the sine basis column", () => {
        const n = 5;
        const impulse = Array.from({ length: n }, (_, i) => (i === 2 ? 1 : 0));
        const frames = [...mod.run({ signal: impulse })];
        const coefficients = frames[frames.length - 1]?.meta["coefficients"] as number[];
        coefficients.forEach((value, k) => {
            expect(value).toBeCloseTo(Math.sin((Math.PI * 3 * (k + 1)) / (n + 1)), 10);
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

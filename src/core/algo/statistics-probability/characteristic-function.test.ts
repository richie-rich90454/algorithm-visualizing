/**
 * characteristic-function.test.ts - Independent summation, transform
 * properties, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./characteristic-function";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBe(steps + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2 * steps);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["steps"]).toBe(steps);
    });
}

/** A direct, independent evaluation of the empirical characteristic function. */
function referencePhi(values: number[], probabilities: number[], t: number): [number, number] {
    let re = 0;
    let im = 0;
    for (let k = 0; k < values.length; k += 1) {
        re += probabilities[k]! * Math.cos(t * values[k]!);
        im += probabilities[k]! * Math.sin(t * values[k]!);
    }
    return [re, im];
}

function curve(frames: VisualFrame[]): { ts: number[]; real: number[]; imaginary: number[] } {
    const meta = frames[frames.length - 1]!.meta;
    return {
        ts: meta["ts"] as number[],
        real: meta["real"] as number[],
        imaginary: meta["imaginary"] as number[],
    };
}

describe("CharacteristicFunction", () => {
    it("matches an independent cosine and sine sum at every grid point", () => {
        const input = mod.defaultInput as {
            values: number[];
            probabilities: number[];
            tMin: number;
            tMax: number;
            steps: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.steps);
        const { ts, real, imaginary } = curve(frames);
        expect(ts.length).toBe(input.steps);
        for (let i = 0; i < ts.length; i += 1) {
            const expected = referencePhi(input.values, input.probabilities, ts[i]!);
            expect(real[i]).toBeCloseTo(expected[0], 10);
            expect(imaginary[i]).toBeCloseTo(expected[1], 10);
        }
    });

    it("keeps phi(0) at one, modulus at most one, real part even and imaginary odd", () => {
        const frames = [...mod.run({ values: [-2, 0, 3], probabilities: [0.2, 0.5, 0.3], tMin: -4, tMax: 4, steps: 17 })];
        checkFrames(frames, 17);
        const { ts, real, imaginary } = curve(frames);
        const center = Math.floor(ts.length / 2);
        expect(ts[center]).toBeCloseTo(0, 10);
        expect(real[center]).toBeCloseTo(1, 10);
        expect(imaginary[center]).toBeCloseTo(0, 10);
        for (let i = 0; i < ts.length; i += 1) {
            expect(Math.hypot(real[i]!, imaginary[i]!)).toBeLessThanOrEqual(1 + 1e-12);
            expect(real[i]).toBeCloseTo(real[ts.length - 1 - i]!, 10);
            expect(imaginary[i]).toBeCloseTo(-imaginary[ts.length - 1 - i]!, 10);
        }
    });

    it("satisfies the convolution identity for independent variables", () => {
        const grid = { tMin: -3, tMax: 3, steps: 9 };
        const phiX = curve([...mod.run({ values: [0, 1], probabilities: [0.5, 0.5], ...grid })]);
        const phiY = curve([...mod.run({ values: [0, 1], probabilities: [0.5, 0.5], ...grid })]);
        const phiSum = curve([...mod.run({ values: [0, 1, 2], probabilities: [0.25, 0.5, 0.25], ...grid })]);
        for (let i = 0; i < grid.steps; i += 1) {
            const a = phiX.real[i]!;
            const b = phiX.imaginary[i]!;
            const c = phiY.real[i]!;
            const d = phiY.imaginary[i]!;
            expect(phiSum.real[i]).toBeCloseTo(a * c - b * d, 10);
            expect(phiSum.imaginary[i]).toBeCloseTo(a * d + b * c, 10);
        }
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

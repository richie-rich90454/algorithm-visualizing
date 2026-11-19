/**
 * quantum-hamming-weight-estimation.test.ts - Exhaustive four-bit verification
 * against an independent Fourier matrix, norm and frame checks, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-hamming-weight-estimation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const amps = frame.meta["amplitudes"] as number[];
        expect(amps.length).toBe(8);
        expect(amps.reduce((sum, v, i) => (i % 2 === 0 ? sum + v ** 2 + amps[i + 1]! ** 2 : sum), 0)).toBeCloseTo(1, 10);
    });
}

function popcount(value: number): number {
    let count = 0;
    while (value > 0) {
        count += value & 1;
        value >>= 1;
    }
    return count;
}

/** Independent complex inverse DFT matrix times the oracle sign vector. */
function independentAmplitudes(bits: number): Array<[number, number]> {
    return Array.from({ length: 4 }, (_, output) => {
        let real = 0;
        let imag = 0;
        for (let input = 0; input < 4; input += 1) {
            const sign = ((bits >> input) & 1) === 1 ? -0.5 : 0.5;
            const angle = (-2 * Math.PI * output * input) / 4;
            const cosine = Math.cos(angle);
            const sine = Math.sin(angle);
            real += sign * cosine;
            imag += sign * sine;
        }
        return [real / 2, imag / 2] as [number, number];
    });
}

describe("QuantumHammingWeightEstimation", () => {
    it("recovers the correct weight for all sixteen four-bit strings", () => {
        for (let bits = 0; bits < 16; bits += 1) {
            const frames = [...mod.run({ bits })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            expect(final["recoveredWeight"]).toBe(popcount(bits));
            expect(final["classicalWeight"]).toBe(popcount(bits));
            const amps = final["amplitudes"] as number[];
            const expected = independentAmplitudes(bits);
            for (let i = 0; i < 4; i += 1) {
                expect(amps[2 * i]).toBeCloseTo(expected[i]![0], 12);
                expect(amps[2 * i + 1]).toBeCloseTo(expected[i]![1], 12);
            }
        }
    });

    it("reports the exact zero-outcome amplitude formula", () => {
        const frames = [...mod.run({ bits: 7 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["amp0"]).toBeCloseTo(-0.5, 12);
        expect(frames[frames.length - 1]!.meta["recoveredWeight"]).toBe(3);
    });

    it("clamps the bit string into the four-bit range", () => {
        const frames = [...mod.run({ bits: -4 })];
        checkFrames(frames);
        expect(frames[0]!.meta["bits"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});

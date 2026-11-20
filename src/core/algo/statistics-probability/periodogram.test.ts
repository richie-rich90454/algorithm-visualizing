/**
 * periodogram.test.ts - Direct DFT cross-check, Parseval, peak detection, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./periodogram";
import type { VisualFrame } from "@/types";

/** Independent direct Fourier power at a single bin. */
function referencePower(signal: number[], k: number): number {
    const n = signal.length;
    let re = 0;
    let im = 0;
    for (let t = 0; t < n; t += 1) {
        const angle = (-2 * Math.PI * k * t) / n;
        re += signal[t] as number * Math.cos(angle);
        im += signal[t] as number * Math.sin(angle);
    }
    return (re * re + im * im) / n;
}

function checkFrames(frames: VisualFrame[], maxFrequency: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(maxFrequency + 1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Periodogram", () => {
    it("matches a direct Fourier computation at every displayed bin", () => {
        const signal = [3, -1, 2, 0, 4, -2, 1, 1, -3, 2, 0, 5, -1, -2, 3, 1];
        const frames = [...mod.run({ signal, maxFrequency: 8 })];
        checkFrames(frames, 8);
        const final = frames[frames.length - 1];
        const power = final?.meta["power"] as number[];
        power.forEach((value, k) => expect(value).toBeCloseTo(referencePower(signal, k), 9));
        expect(power.every((value) => value >= 0)).toBe(true);
    });

    it("satisfies Parseval and locates a pure sinusoid peak", () => {
        const n = 64;
        const signal = Array.from({ length: n }, (_, t) => Math.cos((2 * Math.PI * 10 * t) / n) + 0.5 * Math.sin((2 * Math.PI * 19 * t) / n));
        const frames = [...mod.run({ signal })];
        const final = frames[frames.length - 1];
        const power = final?.meta["power"] as number[];
        let reconstructed = (power[0] as number) + (power[32] as number);
        for (let k = 1; k < 32; k += 1) reconstructed += 2 * (power[k] as number);
        expect(reconstructed).toBeCloseTo(final?.meta["totalPower"] as number, 8);
        expect(final?.meta["dominant"]).toBe(10);
        expect(power[19] as number).toBeGreaterThan(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

/**
 * quantum-amplitude-estimation.test.ts - Exact-phase recovery, normalization, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-amplitude-estimation";
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

describe("Quantum Amplitude Estimation", () => {
    it("recovers exactly representable phases and amplitudes", () => {
        for (let t = 3; t <= 5; t += 1) {
            const dimension = 1 << t;
            for (const k of [1, 2, Math.floor(dimension / 3), dimension - 1]) {
                const frames = [...mod.run({ t, k })];
                const final = frames[frames.length - 1]!.meta;
                expect(final["measured"]).toBe(k);
                expect(Number(final["estimate"])).toBeCloseTo(Math.sin((Math.PI * k) / dimension) ** 2, 8);
                expect(Number(final["amplitude"])).toBeCloseTo(Math.sin((Math.PI * k) / dimension) ** 2, 8);
                expect(Number(final["probability"])).toBeGreaterThan(0.999);
            }
        }
    });

    it("keeps the measurement distribution normalized", () => {
        const frames = [...mod.run({ t: 4, k: 3 })];
        expect(frames.length).toBeGreaterThan(0);
        for (const frame of frames) {
            const probabilities = frame.entities.map((e) => Number(e.value));
            expect(probabilities.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 8);
            expect(probabilities.every((p) => p >= -1e-12 && p <= 1 + 1e-12)).toBe(true);
        }
    });

    it("produces well-formed frames on the default input", () => {
        const input = mod.defaultInput as { t: number; k: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, 1 << input.t);
        const final = frames[frames.length - 1]!.meta;
        expect(final["k"]).toBe(input.k);
        expect(Number(final["estimate"])).toBeCloseTo(Number(final["amplitude"]), 8);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

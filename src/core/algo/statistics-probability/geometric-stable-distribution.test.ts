/** geometric-stable-distribution.test.ts - Characteristic-function properties. */

import { describe, expect, it } from "vitest";
import mod from "./geometric-stable-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    });
}

describe("Geometric Stable Distribution", () => {
    it("has modulus exp(-(scale absolute t)^alpha) at every frequency", () => {
        const alpha = 1.4;
        const beta = 0.3;
        const scale = 1.2;
        const frames = [...mod.run({ alpha, beta, scale, points: 61 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const ts = final["ts"] as number[];
        const moduli = final["moduli"] as number[];
        for (let i = 0; i < ts.length; i += 1) {
            const expected = Math.exp(-Math.pow(scale * Math.abs(ts[i]!), alpha));
            expect(Math.abs(moduli[i]! - expected)).toBeLessThan(1e-12);
        }
    });

    it("is real and even for zero skewness", () => {
        const frames = [...mod.run({ alpha: 1.7, beta: 0, scale: 1, points: 61 })];
        const final = frames[frames.length - 1]!.meta;
        const im = final["im"] as number[];
        const re = final["re"] as number[];
        for (const value of im) expect(Math.abs(value)).toBeLessThan(1e-12);
        for (let i = 0; i < re.length; i += 1) {
            expect(Math.abs(re[i]! - re[re.length - 1 - i]!)).toBeLessThan(1e-12);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

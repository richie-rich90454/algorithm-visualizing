/**
 * hidden-shift-algorithm.test.ts - Hidden shift recovery and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./hidden-shift-algorithm";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function parity(a: number, b: number): number {
    let bits = a & b;
    let p = 0;
    while (bits !== 0) {
        p ^= 1;
        bits &= bits - 1;
    }
    return p;
}

describe("Hidden Shift Algorithm", () => {
    it("recovers several secrets from the sampled parity equations", () => {
        for (const secret of [3, 7, 11, 15]) {
            const frames = [...mod.run({ bits: 4, secret, seed: 12345 })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["found"]).toBe(true);
            expect(Number(final?.["recovered"])).toBe(secret);
            expect(final?.["allParitiesConsistent"]).toBe(true);
        }
    });

    it("brute-force checks every sampled parity equation", () => {
        const frames = [...mod.run({ bits: 5, secret: 19, seed: 99 })];
        const final = frames[frames.length - 1]?.meta;
        const recovered = Number(final?.["recovered"]);
        const samples = frames
            .map((f) => f.meta["sample"])
            .filter((v): v is number => typeof v === "number");
        const phases = frames
            .map((f) => f.meta["phase"])
            .filter((v): v is number => typeof v === "number");
        expect(samples.length).toBeGreaterThanOrEqual(5);
        samples.forEach((y, i) => expect(parity(y, recovered)).toBe(phases[i]));
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

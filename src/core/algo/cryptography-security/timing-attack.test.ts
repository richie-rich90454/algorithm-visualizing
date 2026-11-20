/**
 * timing-attack.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./timing-attack";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Timing side-channel toy attack", () => {
    it("recovers the secret byte for many keys under small noise", () => {
        for (let key = 0; key < 256; key += 17) {
            for (const seed of [1, 7, 42]) {
                const frames = [...mod.run({ key, noise: 0.05, seed })];
                checkFrames(frames);
                const meta = frames[frames.length - 1]?.meta;
                expect(meta?.["key"]).toBe(key);
                expect(meta?.["recovered"]).toBe(key);
                expect((meta?.["measurements"] as number[]).length).toBe(256);
            }
        }
    });

    it("the true key is uniquely the slowest candidate", () => {
        const frames = [...mod.run({ key: 200, noise: 0.05, seed: 3 })];
        const times = frames[frames.length - 1]?.meta["measurements"] as number[];
        const slowest = times.indexOf(Math.max(...times));
        expect(slowest).toBe(200);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

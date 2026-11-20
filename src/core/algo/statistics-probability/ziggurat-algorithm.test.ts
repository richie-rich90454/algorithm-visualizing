/** ziggurat-algorithm.test.ts - Normal moment and determinism checks. */

import { describe, expect, it } from "vitest";
import mod from "./ziggurat-algorithm";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
    });
}

describe("Ziggurat Normal Sampler", () => {
    it("produces near-standard normal moments", () => {
        const frames = [...mod.run({ seed: 999, samples: 12000, layers: 64 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(Math.abs(Number(final["mean"]))).toBeLessThan(0.05);
        expect(Math.abs(Number(final["variance"]) - 1)).toBeLessThan(0.08);
        expect(Number(final["acceptance"])).toBeGreaterThan(0.5);
    });

    it("is deterministic for a fixed seed", () => {
        const a = [...mod.run({ seed: 21, samples: 200 })];
        const b = [...mod.run({ seed: 21, samples: 200 })];
        expect(a[a.length - 1]!.meta["variance"]).toEqual(b[b.length - 1]!.meta["variance"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

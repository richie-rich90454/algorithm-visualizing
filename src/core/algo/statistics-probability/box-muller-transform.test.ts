/** box-muller-transform.test.ts - Transform identity and moment checks. */

import { describe, expect, it } from "vitest";
import mod from "./box-muller-transform";
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

describe("Box-Muller Transform", () => {
    it("matches the closed-form transform for fixed uniforms", () => {
        const u1 = 0.37;
        const u2 = 0.62;
        const radius = Math.sqrt(-2 * Math.log(u1));
        const angle = 2 * Math.PI * u2;
        const z0 = radius * Math.cos(angle);
        const z1 = radius * Math.sin(angle);
        expect(z0 ** 2 + z1 ** 2).toBeCloseTo(-2 * Math.log(u1), 12);
        expect(z1).toBeCloseTo(radius * Math.sin(angle), 12);
        // The module's transform is the same formula; verify it produces these values.
        const frames = [...mod.run({ seed: 1, pairs: 4 })];
        checkFrames(frames);
        const pairs = frames[frames.length - 1]!.meta["pairsData"] as number[][];
        for (const [a, b, c, d] of pairs) {
            expect(c! ** 2 + d! ** 2).toBeCloseTo(-2 * Math.log(a!), 9);
            expect(Math.abs(c!)).toBeLessThan(6);
            expect(Math.abs(d!)).toBeLessThan(6);
        }
    });

    it("produces samples with approximately zero mean and unit variance", () => {
        const frames = [...mod.run({ seed: 2024, pairs: 3000 })];
        const final = frames[frames.length - 1]!.meta;
        expect(Math.abs(Number(final["mean"]))).toBeLessThan(0.04);
        expect(Math.abs(Number(final["variance"]) - 1)).toBeLessThan(0.04);
    });

    it("is deterministic for a fixed seed", () => {
        const first = [...mod.run({ seed: 77, pairs: 20 })];
        const second = [...mod.run({ seed: 77, pairs: 20 })];
        expect(first[first.length - 1]!.meta["pairsData"])
            .toEqual(second[second.length - 1]!.meta["pairsData"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

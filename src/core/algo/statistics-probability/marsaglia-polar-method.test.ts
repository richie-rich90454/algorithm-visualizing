/** marsaglia-polar-method.test.ts - Transform identity and moment checks. */

import { describe, expect, it } from "vitest";
import mod from "./marsaglia-polar-method";
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

describe("Marsaglia Polar Method", () => {
    it("satisfies the exact radius identity on every accepted pair", () => {
        const frames = [...mod.run({ seed: 5, samples: 500 })];
        checkFrames(frames);
        const pairs = frames[frames.length - 1]!.meta["pairs"] as number[][];
        let checked = 0;
        for (const [v0, v1, s, z0, z1, flag] of pairs) {
            expect(v0! ** 2 + v1! ** 2).toBeCloseTo(s!, 12);
            if (flag === 1) {
                expect(z0! ** 2 + z1! ** 2).toBeCloseTo(-2 * Math.log(s!), 9);
                checked += 1;
            }
        }
        expect(checked).toBe(250);
    });

    it("produces near-standard normal moments", () => {
        const frames = [...mod.run({ seed: 2026, samples: 6000 })];
        const final = frames[frames.length - 1]!.meta;
        expect(Math.abs(Number(final["mean"]))).toBeLessThan(0.05);
        expect(Math.abs(Number(final["variance"]) - 1)).toBeLessThan(0.08);
    });

    it("is deterministic for a fixed seed", () => {
        const a = [...mod.run({ seed: 42, samples: 100 })];
        const b = [...mod.run({ seed: 42, samples: 100 })];
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

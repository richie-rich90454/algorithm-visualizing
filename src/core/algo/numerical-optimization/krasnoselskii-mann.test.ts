/**
 * krasnoselskii-mann.test.ts - Fixed-set convergence, monotone distance,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./krasnoselskii-mann";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Krasnoselskii-Mann iteration", () => {
    it("converges to the fixed interval from outside", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        const x = Number(last["x"]);
        expect(x).toBeGreaterThanOrEqual(-1);
        expect(x).toBeLessThanOrEqual(1 + 1e-9);
        expect(Math.abs(x - 1)).toBeLessThan(1e-6);
        expect(Number(last["distance"])).toBeLessThan(1e-6);
    });

    it("shrinks the distance to the fixed set monotonically", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        let prev = Infinity;
        for (const frame of frames) {
            const d = Number(frame.meta["distance"]);
            expect(d).toBeLessThanOrEqual(prev + 1e-12);
            expect(d).toBeGreaterThanOrEqual(0);
            prev = d;
        }
    });

    it("stays in the fixed set when started inside it", () => {
        const frames = [...mod.run({ start: 0.25, a: -1, b: 1, alpha: 0.4, iterations: 10 })];
        checkFrames(frames);
        for (const frame of frames) {
            expect(Number(frame.meta["x"])).toBeCloseTo(0.25, 10);
            expect(Number(frame.meta["distance"])).toBe(0);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

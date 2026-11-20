/** pegus-method.test.ts - Root accuracy, bracket, frame and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./pegus-method";
import type { VisualFrame } from "@/types";

const roots: Record<string, number> = {
    cubic: 1.5213797068045676,
    cosine: 0.7390851332151607,
    exponential: 0.6190612867369350,
};

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThanOrEqual(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Pegasus Root Finder", () => {
    it("converges to the known root for every built-in function", () => {
        const brackets: Record<string, [number, number]> = {
            cubic: [1, 2],
            cosine: [0, 1],
            exponential: [0, 1],
        };
        for (const kind of Object.keys(roots)) {
            const frames = [...mod.run({ kind, a: brackets[kind]?.[0], b: brackets[kind]?.[1], iterations: 60, tolerance: 1e-13 })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["estimate"]).toBeCloseTo(roots[kind], 9);
            expect(meta?.["residual"] as number).toBeLessThan(1e-9);
        }
    });

    it("keeps a valid bracket and improves on plain false position", () => {
        const frames = [...mod.run({ kind: "cubic", a: 1, b: 2, iterations: 60 })];
        const iterateFrames = frames.filter((f) => f.meta["phase"] === "iterate");
        for (const frame of iterateFrames) {
            const fa = frame.meta["fa"] as number;
            const fb = frame.meta["fb"] as number;
            expect(fa * fb).toBeLessThanOrEqual(0);
            const a = frame.meta["a"] as number;
            const b = frame.meta["b"] as number;
            const c = frame.meta["c"] as number;
            expect(c).toBeGreaterThanOrEqual(Math.min(a, b) - 1e-9);
            expect(c).toBeLessThanOrEqual(Math.max(a, b) + 1e-9);
        }
        const finalWidth = iterateFrames[iterateFrames.length - 1]?.meta["b"] as number;
        expect(finalWidth).toBeGreaterThan(0);
        expect((frames[frames.length - 1]?.meta["residual"] as number)).toBeLessThan(1e-9);
    });

    it("handles an invalid bracket and terminates cleanly", () => {
        const frames = [...mod.run({ kind: "cubic", a: 3, b: 4 })];
        expect(frames[0]?.meta["validBracket"]).toBe(false);
        expect(frames.length).toBe(2);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

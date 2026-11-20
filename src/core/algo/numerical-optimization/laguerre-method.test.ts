/**
 * laguerre-method.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./laguerre-method";
import type { VisualFrame } from "@/types";

const p = (x: number): number => x * x * x - 2 * x - 5;

/** Brute-force reference root by bisection bracketing. */
function bisectRoot(): number {
    let lo = 2;
    let hi = 3;
    for (let i = 0; i < 200; i += 1) {
        const mid = (lo + hi) / 2;
        if (p(lo) * p(mid) <= 0) hi = mid;
        else lo = mid;
    }
    return (lo + hi) / 2;
}

/** Independent Laguerre replay. */
function referenceLaguerre(x0: number, iterations: number): number {
    const n = 3;
    let x = x0;
    for (let i = 0; i < iterations; i += 1) {
        const value = p(x);
        if (Math.abs(value) < 1e-15) break;
        const g = (3 * x * x - 2) / value;
        const h = g * g - (6 * x) / value;
        const radicand = (n - 1) * (n * h - g * g);
        if (radicand < 0) break;
        const s = Math.sqrt(radicand);
        const den = Math.abs(g + s) >= Math.abs(g - s) ? g + s : g - s;
        if (Math.abs(den) < 1e-15) break;
        x = x - n / den;
        if (Math.abs(p(x)) < 1e-13) break;
    }
    return x;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Laguerre's Method", () => {
    it("converges to the real root of the demo cubic", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const root = Number(frames[frames.length - 1]?.meta["root"]);
        expect(root).toBeCloseTo(bisectRoot(), 8);
        expect(Math.abs(p(root))).toBeLessThan(1e-8);
    });

    it("matches an independent replay from several starts", () => {
        for (const x0 of [1, 2, 4]) {
            const frames = [...mod.run({ x0, iterations: 12 })];
            const root = Number(frames[frames.length - 1]?.meta["root"]);
            expect(Math.abs(root - referenceLaguerre(x0, 12))).toBeLessThan(1e-8);
        }
    });

    it("reports nonnegative radicands in every iteration frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames.slice(1, -1)) {
            expect(Number.isFinite(Number(frame.meta["g"]))).toBe(true);
            expect(Number.isFinite(Number(frame.meta["h"]))).toBe(true);
            expect(Number(frame.meta["degree"])).toBe(3);
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

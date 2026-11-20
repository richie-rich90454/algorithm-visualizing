/**
 * muller-method.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./muller-method";
import type { VisualFrame } from "@/types";

const f = (x: number): number => x * x - 2;

/** Independent Muller replay using divided differences. */
function reference(x0: number, x1: number, x2: number, iterations: number): number {
    for (let i = 0; i < iterations; i += 1) {
        const f0 = f(x0);
        const f1 = f(x1);
        const f2 = f(x2);
        const h1 = x1 - x0;
        const h2 = x2 - x1;
        const d1 = (f1 - f0) / h1;
        const d2 = (f2 - f1) / h2;
        const a = (d2 - d1) / (h1 + h2);
        const b = d2 + a * h2;
        const disc = b * b - 4 * a * f2;
        if (disc < 0) break;
        const s = Math.sqrt(disc);
        const den = Math.abs(b + s) >= Math.abs(b - s) ? b + s : b - s;
        if (Math.abs(den) < 1e-15) break;
        const next = x2 - (2 * f2) / den;
        x0 = x1;
        x1 = x2;
        x2 = next;
        if (Math.abs(f(next)) < 1e-13) break;
    }
    return x2;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Muller's Method", () => {
    it("converges to the square root of two", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const root = Number(frames[frames.length - 1]?.meta["root"]);
        expect(root).toBeCloseTo(Math.SQRT2, 8);
        expect(Math.abs(f(root))).toBeLessThan(1e-8);
    });

    it("matches an independent replay for several starting triples", () => {
        const triples: Array<[number, number, number]> = [
            [1, 2, 3],
            [0, 1, 2],
            [0.5, 1.5, 2.5],
        ];
        for (const [x0, x1, x2] of triples) {
            const frames = [...mod.run({ x0, x1, x2, iterations: 12 })];
            const root = Number(frames[frames.length - 1]?.meta["root"]);
            expect(Math.abs(root - reference(x0, x1, x2, 12))).toBeLessThan(1e-8);
        }
    });

    it("keeps the newest interpolation point equal to the reported root", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames.slice(1, -1)) {
            const newest = Number(frame.entities[2]?.value);
            expect(newest).toBeCloseTo(Number(frame.meta["root"]), 6);
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

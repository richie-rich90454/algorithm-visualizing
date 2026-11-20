import { describe, expect, it } from "vitest";
import mod from "./quadratic-equation-solver";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => Number.isFinite(entity.x) && Number.isFinite(entity.y))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function rootsFrom(frames: VisualFrame[]): number[] {
    return (frames[frames.length - 1]?.meta["roots"] as number[]) ?? [];
}

describe("Quadratic Equation Solver", () => {
    it("finds roots that annihilate the polynomial on random inputs", () => {
        let seed = 9182;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const a = (next() % 9) + 1;
            const b = (next() % 21) - 10;
            const c = (next() % 21) - 10;
            const frames = [...mod.run({ a, b, c, samples: 20 })];
            checkFrames(frames);
            const roots = rootsFrom(frames);
            const d = b * b - 4 * a * c;
            if (d > 0) {
                expect(roots.length).toBe(2);
            } else if (d === 0) {
                expect(roots.length).toBe(1);
            } else {
                expect(roots.length).toBe(0);
            }
            for (const r of roots) {
                expect(Math.abs(a * r * r + b * r + c)).toBeLessThan(1e-6);
            }
        }
    });

    it("handles a repeated root and a wide separation of root sizes", () => {
        const repeated = [...mod.run({ a: 1, b: 2, c: 1 })];
        expect(rootsFrom(repeated)[0]).toBeCloseTo(-1, 10);
        const wide = [...mod.run({ a: 1, b: -1000001, c: 1000000 })];
        const roots = rootsFrom(wide).slice().sort((p, q) => p - q);
        expect(roots[0]).toBeCloseTo(1, 6);
        expect(roots[1]).toBeCloseTo(1000000, 4);
    });

    it("handles a linear and a degenerate input", () => {
        const linear = [...mod.run({ a: 0, b: 2, c: -6 })];
        expect(rootsFrom(linear)[0]).toBeCloseTo(3, 10);
        const degenerate = [...mod.run({ a: 0, b: 0, c: 5 })];
        expect(rootsFrom(degenerate).length).toBe(0);
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

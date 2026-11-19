import { describe, expect, it } from "vitest";
import mod from "./agm-arithmetic-geometric-mean";
import type { VisualFrame } from "@/types";

function reference(a: number, b: number): number {
    let x = a;
    let y = b;
    for (let i = 0; i < 200; i += 1) {
        const nextX = (x + y) / 2;
        const nextY = Math.sqrt(x * y);
        if (Math.abs(nextX - nextY) < 1e-15) {
            return (nextX + nextY) / 2;
        }
        x = nextX;
        y = nextY;
    }
    return (x + y) / 2;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function lastResult(frames: VisualFrame[]): number {
    return Number(frames[frames.length - 1]?.meta["result"]);
}

describe("Arithmetic-Geometric Mean", () => {
    it("matches an independent AGM iteration", () => {
        const pairs: Array<[number, number]> = [
            [1, 1 / Math.sqrt(2)],
            [1, 2],
            [3, 7],
            [0.5, 12.25],
            [10, 10],
        ];
        for (const [a, b] of pairs) {
            const frames = [...mod.run({ a, b, tolerance: 1e-14, maxIterations: 60 })];
            checkFrames(frames);
            expect(lastResult(frames)).toBeCloseTo(reference(a, b), 10);
        }
    });

    it("respects symmetry and scaling", () => {
        const forward = lastResult([...mod.run({ a: 2, b: 8 })]);
        const reversed = lastResult([...mod.run({ a: 8, b: 2 })]);
        expect(forward).toBeCloseTo(reversed, 12);
        const scaled = lastResult([...mod.run({ a: 20, b: 80 })]);
        expect(scaled).toBeCloseTo(10 * forward, 10);
    });

    it("converges on the default Gauss constant input near 0.84721308", () => {
        expect(lastResult([...mod.run(mod.defaultInput)])).toBeCloseTo(0.8472130848, 8);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

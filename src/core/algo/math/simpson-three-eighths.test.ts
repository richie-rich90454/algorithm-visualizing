import { describe, expect, it } from "vitest";
import mod from "./simpson-three-eighths";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, number | string> {
    return frames[frames.length - 1]?.meta as Record<string, number | string>;
}

// Independent fine-grained trapezoid reference.
function trapezoid(f: (x: number) => number, a: number, b: number, n: number): number {
    const h = (b - a) / n;
    let sum = (f(a) + f(b)) / 2;
    for (let i = 1; i < n; i += 1) sum += f(a + h * i);
    return sum * h;
}

describe("Simpson Three Eighths Rule", () => {
    it("is exact on polynomials of degree up to three", () => {
        for (const interval of [[0, 3], [-2, 1], [0.5, 4.5]]) {
            for (const f of ["poly2", "poly3"] as const) {
                const frames = [...mod.run({ a: interval[0], b: interval[1], n: 12, f })];
                checkFrames(frames);
                const meta = finalMeta(frames);
                expect(Number(meta["estimate"])).toBeCloseTo(Number(meta["exact"]), 9);
            }
        }
    });

    it("approaches an independent trapezoid reference for sine and exponential", () => {
        const cases: Array<{ f: "sin" | "exp"; fn: (x: number) => number }> = [
            { f: "sin", fn: Math.sin },
            { f: "exp", fn: Math.exp },
        ];
        for (const { f, fn } of cases) {
            const frames = [...mod.run({ a: 0, b: 2, n: 300, f })];
            const estimate = Number(finalMeta(frames)["estimate"]);
            const reference = trapezoid(fn, 0, 2, 200000);
            expect(Math.abs(estimate - reference)).toBeLessThan(1e-6);
        }
    });

    it("rounds a panel count up to a multiple of three", () => {
        const frames = [...mod.run({ a: 0, b: 3, n: 10, f: "poly3" })];
        expect(Number(finalMeta(frames)["n"])).toBe(12);
        expect(Number(finalMeta(frames)["estimate"])).toBeCloseTo(14.25, 9);
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

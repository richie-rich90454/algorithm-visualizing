import { describe, expect, it } from "vitest";
import mod from "./regula-falsi-illinois";
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

const F: Record<string, (x: number) => number> = {
    "x2-2": (x) => x * x - 2,
    "x3-x-2": (x) => x * x * x - x - 2,
};

function rootFrom(frames: VisualFrame[]): number {
    return Number(frames[frames.length - 1]?.meta["root"]);
}

describe("Illinois False Position", () => {
    it("converges to analytic roots and keeps the bracket valid", () => {
        const cases = [
            { f: "x2-2" as const, a: 1, b: 2, exact: Math.sqrt(2) },
            { f: "x3-x-2" as const, a: 1, b: 2, exact: 1.52137970680457 },
            { f: "x2-2" as const, a: 0, b: 3, exact: Math.sqrt(2) },
        ];
        for (const { f, a, b, exact } of cases) {
            const frames = [...mod.run({ f, a, b, iterations: 100 })];
            checkFrames(frames);
            const fn = F[f]!;
            for (const frame of frames) {
                const lo = Number(frame.meta["a"]);
                const hi = Number(frame.meta["b"]);
                expect(fn(lo) * fn(hi)).toBeLessThanOrEqual(0);
            }
            expect(Math.abs(rootFrom(frames) - exact)).toBeLessThan(1e-9);
        }
    });

    it("residuals decrease monotonically toward zero", () => {
        const frames = [...mod.run({ f: "x2-2", a: 1, b: 2, iterations: 40 })];
        const residuals = frames.slice(1, -1).map((frame) => Number(frame.meta["residual"]));
        expect(residuals.length).toBeGreaterThan(3);
        expect(residuals[residuals.length - 1]!).toBeLessThan(residuals[0]!);
        expect(residuals[residuals.length - 1]!).toBeLessThan(1e-12);
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

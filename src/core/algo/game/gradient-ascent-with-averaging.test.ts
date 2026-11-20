import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./gradient-ascent-with-averaging";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        frame.entities.forEach((entity) => {
            expect(Number.isFinite(entity.value as number)).toBe(true);
            expect(entity.id).toMatch(/^bar-/);
        });
    });
}

describe("Gradient ascent with averaging", () => {
    it("keeps average regret near zero in matching pennies", () => {
        const fs = frames({ payoff: [[1, -1], [-1, 1]], iterations: 200 });
        shapes(fs);
        const last = fs[fs.length - 1];
        const strategy = last?.meta["averageStrategy"] as number[];
        expect(strategy.length).toBe(2);
        expect(strategy[0] + strategy[1]).toBeCloseTo(1, 5);
        strategy.forEach((p) => {
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
        });
        expect(Math.abs(Number(last?.meta["averagePayoff"]))).toBeLessThan(0.05);
        expect(Number(last?.meta["averageRegret"])).toBeLessThan(0.05);
    });

    it("converges to the dominant action when one always pays more", () => {
        const payoff = [
            [2, 3],
            [0, 1],
        ];
        const fs = frames({ payoff, iterations: 120 });
        shapes(fs);
        const last = fs[fs.length - 1];
        // The opponent alternates actions 0 and 1, so the best response action
        // earns the average of 2 and 3 against an average of 0 and 1.
        expect(Number(last?.meta["averagePayoff"])).toBeCloseTo(2.5, 4);
        expect((last?.meta["averageStrategy"] as number[])[0]).toBeGreaterThan(0.95);
    });

    it("terminates on the default input", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        expect(Number(fs[fs.length - 1]?.meta["iterations"])).toBe(120);
    });
});

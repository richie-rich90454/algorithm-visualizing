/**
 * richardson-extrapolation.test.ts - Extrapolation accuracy, table identities, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./richardson-extrapolation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], levels: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Number(frame.meta["levels"])).toBe(levels);
        expect(Number(frame.meta["rows"] ?? levels)).toBeGreaterThan(0);
    });
}

describe("RichardsonExtrapolation", () => {
    it("first column equals brute-force forward differences", () => {
        const cases = [
            { func: "sin" as const, f: Math.sin, x: 1, exact: Math.cos(1) },
            { func: "exp" as const, f: Math.exp, x: 0.7, exact: Math.exp(0.7) },
            { func: "poly" as const, f: (t: number) => t ** 3 - 2 * t + 1, x: 1.3, exact: 3 * 1.3 ** 2 - 2 },
        ];
        const h = 0.08;
        const levels = 4;
        for (const c of cases) {
            const frames = [...mod.run({ func: c.func, x: c.x, h, levels })];
            checkFrames(frames, levels);
            const table = JSON.parse(String(frames[frames.length - 1]?.meta["table"])) as number[][];
            for (let i = 0; i < levels; i += 1) {
                const step = h / 2 ** i;
                expect(table[i]![0]!).toBeCloseTo((c.f(c.x + step) - c.f(c.x)) / step, 10);
            }
        }
    });

    it("table satisfies the Richardson recurrence on every upper entry", () => {
        const frames = [...mod.run({ func: "sin", x: 0.5, h: 0.1, levels: 5 })];
        const table = JSON.parse(String(frames[frames.length - 1]?.meta["table"])) as number[][];
        for (let j = 1; j < 5; j += 1) {
            const factor = 2 ** j - 1;
            for (let i = j; i < 5; i += 1) {
                const expected = table[i]![j - 1]! + (table[i]![j - 1]! - table[i - 1]![j - 1]!) / factor;
                expect(table[i]![j]!).toBeCloseTo(expected, 10);
            }
        }
    });

    it("extrapolation is more accurate than the raw estimate", () => {
        for (const c of [
            { func: "sin" as const, x: 1, exact: Math.cos(1) },
            { func: "exp" as const, x: 0.4, exact: Math.exp(0.4) },
            { func: "poly" as const, x: 2, exact: 3 * 4 - 2 },
        ]) {
            const frames = [...mod.run({ func: c.func, x: c.x, h: 0.2, levels: 5 })];
            const meta = frames[frames.length - 1]?.meta;
            const estimate = Number(meta?.["estimate"]);
            const raw = Number(meta?.["raw"]);
            expect(Math.abs(estimate - c.exact)).toBeLessThan(Math.abs(raw - c.exact));
            expect(estimate).toBeCloseTo(c.exact, 6);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

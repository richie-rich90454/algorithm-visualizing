/**
 * maximum-a-posteriori-estimation.test.ts - Analytic mode, brute-force grid, frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./maximum-a-posteriori-estimation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["family"]).toBe("map-estimation");
    });
}

describe("Maximum A Posteriori Estimation", () => {
    it("matches the analytic Beta mode and a brute-force grid maximum", () => {
        const input = { trials: 10, successes: 6, alpha: 2, beta: 2 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 101);
        const meta = frames[frames.length - 1]?.meta;
        const a = input.successes + input.alpha;
        const b = input.trials - input.successes + input.beta;
        const mode = (a - 1) / (a + b - 2);
        expect(meta?.["analyticMode"]).toBeCloseTo(mode, 5);

        const grid = Array.from({ length: 401 }, (_, i) => (i + 1) / 402);
        const fineFrames = [...mod.run({ ...input, grid })];
        const fineMeta = fineFrames[fineFrames.length - 1]?.meta;
        expect(Math.abs(Number(fineMeta?.["gridMode"]) - mode)).toBeLessThan(1 / 402 + 1e-6);
        expect(fineMeta?.["matches"]).toBe(true);
    });

    it("reduces to the sample proportion under a flat prior", () => {
        const frames = [...mod.run({ trials: 20, successes: 7, alpha: 1, beta: 1, grid: Array.from({ length: 301 }, (_, i) => (i + 1) / 302) })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["analyticMode"]).toBeCloseTo(7 / 20, 5);
        expect(Math.abs(Number(meta?.["gridMode"]) - 7 / 20)).toBeLessThan(1 / 302 + 1e-6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

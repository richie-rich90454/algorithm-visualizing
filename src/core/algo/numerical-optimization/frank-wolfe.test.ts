/**
 * frank-wolfe.test.ts - Optimality versus clipped target, feasibility,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./frank-wolfe";
import type { VisualFrame, MetaValue } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function vec(meta: Record<string, MetaValue>, key: string): number[] {
    const raw = meta[key];
    return Array.isArray(raw) ? raw.map((v) => Number(v)) : [];
}

function objective(x: number[], target: number[]): number {
    return 0.5 * x.reduce((sum, value, i) => sum + (value - target[i]!) ** 2, 0);
}

describe("Frank-Wolfe", () => {
    it("converges to the clipped target minimizer", () => {
        const cases = [
            [1.3, -0.2, 0.5],
            [0.8, 0.2, 0.6],
            [-0.5, 1.4, 0.25, 2],
        ];
        for (const target of cases) {
            const frames = [...mod.run({ target, iterations: 400 })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!.meta;
            const x = vec(last, "x");
            const minimizer = target.map((v) => Math.min(1, Math.max(0, v)));
            x.forEach((value, i) => expect(value).toBeCloseTo(minimizer[i]!, 2));
            const fStar = objective(minimizer, target);
            expect(objective(x, target) - fStar).toBeLessThan(1e-3);
        }
    });

    it("keeps every iterate inside the box", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        for (const frame of frames) {
            const x = vec(frame.meta, "x");
            for (const value of x) {
                expect(value).toBeGreaterThanOrEqual(-1e-12);
                expect(value).toBeLessThanOrEqual(1 + 1e-12);
            }
        }
    });

    it("reports an objective that decreases from the first step", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const first = Number(frames[0]!.meta["objective"]);
        const final = Number(frames[frames.length - 1]!.meta["objective"]);
        expect(final).toBeLessThan(first);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

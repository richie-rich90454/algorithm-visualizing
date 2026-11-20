/**
 * jensen-shannon-divergence.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./jensen-shannon-divergence";
import type { VisualFrame } from "@/types";

/** Independent reference implementation using natural logs converted to bits. */
function reference(p: number[], q: number[]): number {
    const m = p.map((value, i) => 0.5 * (value + (q[i] ?? 0)));
    const kl = (a: number[], b: number[]) =>
        a.reduce((sum, value, i) => sum + (value === 0 ? 0 : value * Math.log(value / (b[i] ?? 0))), 0) / Math.LN2;
    return 0.5 * kl(p, m) + 0.5 * kl(q, m);
}

function checkFrames(frames: VisualFrame[], cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Jensen-Shannon divergence", () => {
    it("matches an independent reference and satisfies the defining properties", () => {
        const cases: Array<{ p: number[]; q: number[] }> = [
            { p: [0.5, 0.25, 0.25, 0], q: [0.1, 0.1, 0.4, 0.4] },
            { p: [0.5, 0.5, 0, 0], q: [0, 0, 0.5, 0.5] },
            { p: [0.2, 0.3, 0.5], q: [0.2, 0.3, 0.5] },
        ];
        for (const { p, q } of cases) {
            const frames = [...mod.run({ p, q })] as VisualFrame[];
            checkFrames(frames, p.length);
            const finalMeta = frames[frames.length - 1]?.meta;
            const value = Number(finalMeta?.["divergence"]);
            expect(value).toBeCloseTo(reference(p, q), 9);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1 + 1e-9);
            // Symmetry: swapping arguments must give the same divergence.
            const swapped = [...mod.run({ p: q, q: p })];
            const swappedMeta = swapped[swapped.length - 1]?.meta;
            expect(Number(swappedMeta?.["divergence"])).toBeCloseTo(value, 9);
        }
    });

    it("returns zero for identical distributions and one for disjoint supports", () => {
        const same = [...mod.run({ p: [0.3, 0.3, 0.4], q: [0.3, 0.3, 0.4] })];
        expect(Number(same[same.length - 1]?.meta["divergence"])).toBeCloseTo(0, 9);
        const disjoint = [...mod.run({ p: [0.5, 0.5, 0, 0], q: [0, 0, 0.5, 0.5] })];
        expect(Number(disjoint[disjoint.length - 1]?.meta["divergence"])).toBeCloseTo(1, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

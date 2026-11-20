/** chatterjeexi-correlation.test.ts - brute-force xi, monotone bounds, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./chatterjeexi-correlation";
import type { VisualFrame } from "@/types";

function xiReference(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a]! - x[b]! || y[a]! - y[b]!);
    const yOrder = Array.from({ length: n }, (_, i) => i).sort((a, b) => y[a]! - y[b]! || x[a]! - x[b]!);
    const rank = new Array<number>(n).fill(0);
    yOrder.forEach((idx, r) => { rank[idx] = r + 1; });
    const sorted = order.map((idx) => rank[idx]!);
    let total = 0;
    for (let i = 0; i + 1 < n; i += 1) total += Math.abs(sorted[i + 1]! - sorted[i]!);
    return n >= 3 ? 1 - (3 * total) / (n * n - 1) : 0;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Chatterjee Rank Correlation", () => {
    it("matches an independently computed rank-jump statistic", () => {
        const cases = [
            { x: [1, 2, 3, 4, 5, 6, 7, 8], y: [2, 1, 4, 3, 6, 5, 8, 7] },
            { x: [3, 1, 4, 1, 5, 9, 2, 6], y: [5, 3, 5, 8, 9, 2, 7, 1] },
            { x: [0.2, 0.7, 0.4, 0.9, 0.1], y: [10, 4, 8, 2, 12] },
        ];
        for (const { x, y } of cases) {
            const frames = [...mod.run({ x, y })];
            checkFrames(frames, x.length);
            expect(Number(frames.at(-1)?.meta["xi"])).toBeCloseTo(xiReference(x, y), 9);
        }
    });

    it("reaches the finite-sample bound for monotone increasing and decreasing data", () => {
        const x = [1, 2, 3, 4, 5, 6, 7];
        const increasing = [...mod.run({ x, y: [1, 2, 3, 4, 5, 6, 7] })].at(-1)?.meta;
        const decreasing = [...mod.run({ x, y: [7, 6, 5, 4, 3, 2, 1] })].at(-1)?.meta;
        expect(Number(increasing?.["xi"])).toBeCloseTo(1 - 3 / 8, 9);
        expect(Number(decreasing?.["xi"])).toBeCloseTo(1 - 3 / 8, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

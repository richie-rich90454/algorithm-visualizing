/**
 * spearman-rank-correlation.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./spearman-rank-correlation";
import type { VisualFrame } from "@/types";

/** Independent rank with average ties. */
function referenceRanks(values: number[]): number[] {
    return values.map((v) => {
        const smaller = values.filter((u) => u < v).length;
        const equal = values.filter((u) => u === v).length;
        return smaller + (equal + 1) / 2;
    });
}

function referencePearson(a: number[], b: number[]): number {
    const n = a.length;
    const ma = a.reduce((x, y) => x + y, 0) / n;
    const mb = b.reduce((x, y) => x + y, 0) / n;
    let num = 0;
    let da2 = 0;
    let db2 = 0;
    for (let i = 0; i < n; i += 1) {
        num += ((a[i] as number) - ma) * ((b[i] as number) - mb);
        da2 += ((a[i] as number) - ma) ** 2;
        db2 += ((b[i] as number) - mb) ** 2;
    }
    return num / Math.sqrt(da2 * db2);
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Spearman Rank Correlation", () => {
    it("matches an independent rank and Pearson computation", () => {
        const cases = [
            { x: [1, 2, 3, 4, 5], y: [3, 1, 4, 5, 2] },
            { x: [5, 5, 2, 9, 2], y: [1, 3, 3, 8, 8] },
            { x: [10, 20, 30, 40, 50, 60], y: [60, 50, 40, 30, 20, 10] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.x.length);
            const meta = frames[frames.length - 1]?.meta;
            const rx = referenceRanks(testCase.x);
            const ry = referenceRanks(testCase.y);
            const expected = referencePearson(rx, ry);
            expect(meta?.["rho"] as number).toBeCloseTo(expected, 10);
            const reportedRanks = meta?.["rankX"] as number[];
            for (let i = 0; i < rx.length; i += 1) {
                expect(reportedRanks[i]).toBe(rx[i]);
            }
            const d2 = rx.reduce((acc, r, i) => acc + (r - (ry[i] as number)) ** 2, 0);
            expect(meta?.["dSquaredSum"] as number).toBeCloseTo(d2, 10);
        }
    });

    it("gives plus and minus one for perfect monotone data", () => {
        const increasing = [...mod.run({ x: [1, 2, 3, 4], y: [2, 4, 6, 8] })];
        expect(increasing[increasing.length - 1]?.meta["rho"] as number).toBeCloseTo(1, 10);
        const decreasing = [...mod.run({ x: [1, 2, 3, 4], y: [8, 6, 4, 2] })];
        expect(decreasing[decreasing.length - 1]?.meta["rho"] as number).toBeCloseTo(-1, 10);
    });

    it("gives zero for all tied ranks", () => {
        const frames = [...mod.run({ x: [1, 1, 1, 1], y: [2, 3, 4, 5] })];
        expect(frames[frames.length - 1]?.meta["rho"] as number).toBeCloseTo(0, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

/**
 * mamba-2.test.ts - Independent sequential-scan cross-check, selective-decay
 * property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./mamba-2";
import type { VisualFrame } from "@/types";

function sequentialScan(x: number[], a: number[], b: number[], c: number[], h0: number) {
    let h = h0;
    const hs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < x.length; i += 1) {
        h = (a[i] ?? 0) * h + (b[i] ?? 0) * (x[i] ?? 0);
        hs.push(h);
        ys.push((c[i] ?? 0) * h);
    }
    return { hs, ys };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBe(n);
    });
}

describe("Mamba2SSDScan", () => {
    it("matches a step-by-step sequential scan on many inputs", () => {
        const cases = [
            { x: [1, 2, 3, 4], a: [0.9, 0.8, 0.7, 0.6], b: [1, 1, 1, 1], c: [1, 1, 1, 1], h0: 0 },
            { x: [2, -1, 3], a: [0.5, 0.5, 0.5], b: [1, 2, 0.5], c: [0.5, 1, 2], h0: 1 },
            { x: [1, 1, 1, 1, 1], a: [0.25, 0.5, 0.75, 0.9, 0.99], b: [2, 2, 2, 2, 2], c: [1, 0, 1, 0, 1], h0: 0 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.x.length);
            const final = frames[frames.length - 1]?.meta;
            const expected = sequentialScan(input.x, input.a, input.b, input.c, input.h0);
            const actualH = final?.["h"] as number[];
            const actualY = final?.["y"] as number[];
            for (let i = 0; i < input.x.length; i += 1) {
                expect(Math.abs((actualH[i] ?? 0) - (expected.hs[i] ?? 0))).toBeLessThan(1e-6);
                expect(Math.abs((actualY[i] ?? 0) - (expected.ys[i] ?? 0))).toBeLessThan(1e-6);
            }
        }
    });

    it("reduces to a cumulative sum with unit gates", () => {
        const x = [1, 2, 3];
        const frames = [...mod.run({ x, a: [1, 1, 1], b: [1, 1, 1], c: [1, 1, 1], h0: 0 })];
        const y = frames[frames.length - 1]?.meta["y"] as number[];
        expect(y).toEqual([1, 3, 6]);
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

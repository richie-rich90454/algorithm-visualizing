/**
 * quantum-counting.test.ts - Estimate accuracy check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-counting";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], T: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(T);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Quantum Counting", () => {
    it("estimates every possible marked count within phase resolution", () => {
        const n = 2;
        const N = 1 << n;
        const t = 7;
        for (let M = 0; M <= N; M += 1) {
            const marked = Array.from({ length: M }, (_, i) => i);
            const frames = [...mod.run({ n, t, marked })];
            checkFrames(frames, 1 << t);
            const meta = frames[frames.length - 1]!.meta;
            expect(meta["M"]).toBe(M);
            // Phase resolution is 1/2^t; allow that plus a small margin in count units.
            expect(Number(meta["estimateM"])).toBeCloseTo(M, 0);
        }
    });

    it("keeps probability normalized and the leading outcome on a valid phase", () => {
        const frames = [...mod.run({ n: 2, t: 6, marked: [0, 3] })];
        const meta = frames[frames.length - 1]!.meta;
        expect(Number(meta["probSum"])).toBeCloseTo(1, 6);
        const outcome = Number(meta["outcome"]);
        expect(outcome).toBeGreaterThanOrEqual(0);
        expect(outcome).toBeLessThan(1 << 6);
        const probabilities = meta["probabilities"] as number[];
        expect(probabilities.length).toBe(1 << 6);
        expect(probabilities[outcome]).toBe(Math.max(...probabilities));
    });

    it("gives zero estimate with no marked items", () => {
        const frames = [...mod.run({ n: 2, t: 6, marked: [] })];
        const meta = frames[frames.length - 1]!.meta;
        expect(Number(meta["estimateM"])).toBeCloseTo(0, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

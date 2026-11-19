/**
 * cross-entropy-information.test.ts - Entropy identities and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./cross-entropy-information";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["family"]).toBe("cross-entropy");
    });
}

describe("Cross Entropy Information", () => {
    it("matches an independent sum and satisfies Gibbs inequality", () => {
        const p = [0.5, 0.25, 0.15, 0.1];
        const q = [0.25, 0.25, 0.25, 0.25];
        const frames = [...mod.run({ p, q })];
        checkFrames(frames, p.length);
        const meta = frames[frames.length - 1]?.meta;
        const expectedCross = -p.reduce((sum, pi, i) => sum + pi * Math.log2(q[i] ?? 0), 0);
        const expectedH = -p.reduce((sum, pi) => sum + (pi > 0 ? pi * Math.log2(pi) : 0), 0);
        expect(meta?.["hCross"]).toBeCloseTo(expectedCross, 5);
        expect(meta?.["hP"]).toBeCloseTo(expectedH, 5);
        expect(meta?.["kl"]).toBeCloseTo(expectedCross - expectedH, 5);
        expect(Number(meta?.["kl"])).toBeGreaterThanOrEqual(-1e-9);
        expect(meta?.["nonnegative"]).toBe(true);
    });

    it("gives zero divergence when the distributions match", () => {
        const p = [0.2, 0.3, 0.5];
        const frames = [...mod.run({ p, q: [...p] })];
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["kl"])).toBeCloseTo(0, 6);
        expect(Number(meta?.["hCross"])).toBeCloseTo(Number(meta?.["hP"]), 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

/** lottery-ticket-hypothesis.test.ts - Brute-force mask check, survivor properties, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { iterativeMagnitudePruning, pruneMask } from "./lottery-ticket-hypothesis";
import type { VisualFrame } from "@/types";

interface Input {
    weights: number[];
    pruneRate: number;
    rounds: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Lottery ticket hypothesis (magnitude pruning)", () => {
    it("pruneMask removes exactly k smallest magnitudes with index tie-breaks", () => {
        const weights = [0.1, -0.5, 0.1, 1.2, -0.3];
        const { mask, pruned, k } = pruneMask(weights, 0.4);
        expect(k).toBe(2);
        const sorted = weights
            .map((w, i) => ({ i, m: Math.abs(w) }))
            .sort((a, b) => a.m - b.m || a.i - b.i);
        expect(new Set(pruned)).toEqual(new Set(sorted.slice(0, 2).map((s) => s.i)));
        pruned.forEach((i) => expect(mask[i]).toBe(false));
        expect(mask.filter(Boolean).length).toBe(weights.length - 2);
    });

    it("survivors keep their exact initial values and never increase in count", () => {
        const weights = [-0.9, 0.2, 1.3, -0.05, 0.6, -1.1, 0.35, 0.02];
        const { masks, survivors, active } = iterativeMagnitudePruning(weights, 0.3, 3);
        expect(masks.length).toBe(3);
        let previous = weights.length;
        for (const mask of masks) {
            const count = mask.filter(Boolean).length;
            expect(count).toBeLessThanOrEqual(previous);
            previous = count;
        }
        expect(active).toBe(previous);
        survivors.forEach((v, i) => {
            if (v !== 0) expect(v).toBe(weights[i]);
        });
        expect(survivors.filter((v) => v !== 0).length).toBe(active);
    });

    it("handles empty and single-weight inputs", () => {
        expect(pruneMask([], 0.5).mask.length).toBe(0);
        expect(pruneMask([0.5], 0.9).k).toBe(0);
        const single = iterativeMagnitudePruning([0.5], 0.5, 3);
        expect(single.masks.length).toBe(0);
        expect(single.active).toBe(1);
    });

    it("matches the pruning result through the module run metadata", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = iterativeMagnitudePruning(input.weights, input.pruneRate, input.rounds);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["alive"]).toBe(expected.active);
        const survivors = final?.["survivors"] as number[];
        survivors.forEach((v, i) => expect(v).toBe(expected.survivors[i]));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});

/** gradient-checkpointing.test.ts - Reference plan check, recompute bound, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { checkpointPlan } from "./gradient-checkpointing";
import type { VisualFrame } from "@/types";

interface Input {
    layers: number;
    segment?: number;
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

describe("Gradient checkpointing", () => {
    it("checkpoints are multiples of k and recompute counts are exact", () => {
        for (const n of [1, 2, 7, 16, 25, 50]) {
            const { checkpoints, k, recompute } = checkpointPlan(n);
            expect(checkpoints[0]).toBe(0);
            checkpoints.forEach((c) => expect(c % k).toBe(0));
            expect(recompute.length).toBe(n);
            for (let i = 0; i < n; i += 1) {
                let previous = 0;
                for (const c of checkpoints) {
                    if (c <= i) previous = c;
                    else break;
                }
                expect(recompute[i]).toBe(i - previous);
                expect(recompute[i]!).toBeLessThan(k);
            }
        }
    });

    it("segments partition all layers and never exceed k", () => {
        const { segments, k } = checkpointPlan(30, 4);
        const flat = segments.flat();
        expect(flat.length).toBe(30);
        expect(new Set(flat).size).toBe(30);
        segments.forEach((s) => expect(s.length).toBeLessThanOrEqual(k));
    });

    it("stored count follows the expected formula and handles empty input", () => {
        expect(checkpointPlan(16).checkpoints).toEqual([0, 4, 8, 12]);
        expect(checkpointPlan(0).checkpoints.length).toBe(0);
        expect(checkpointPlan(0).recompute.length).toBe(0);
        expect(checkpointPlan(5, 1).recompute.every((v) => v === 0)).toBe(true);
    });

    it("matches the plan through the module run metadata", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = checkpointPlan(input.layers);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["checkpoints"]).toEqual(expected.checkpoints);
        expect(final?.["k"]).toBe(expected.k);
        expect(final?.["stored"]).toBe(expected.checkpoints.length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});

/** leaky-relu.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, { leakyReluFor } from "./leaky-relu";
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
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((e) => {
            expect(e.metadata["row"]).toBeGreaterThanOrEqual(0);
            expect(e.metadata["col"]).toBeGreaterThanOrEqual(0);
        });
    });
}

describe("Leaky ReLU", () => {
    it("matches an independent reference and finite differences", () => {
        const input = mod.defaultInput as { values: number[]; alpha: number };
        const alpha = input.alpha;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.values.length);
        const final = frames[frames.length - 1]?.meta["values"] as number[];
        input.values.forEach((x, i) => {
            const expected = x > 0 ? x : alpha * x;
            expect(final[i]).toBeCloseTo(expected, 10);
            const r = leakyReluFor(x, alpha);
            expect(r.value).toBeCloseTo(expected, 10);
            if (Math.abs(x) > 1e-6) {
                const h = 1e-5;
                const numeric = (leakyReluFor(x + h, alpha).value - leakyReluFor(x - h, alpha).value) / (2 * h);
                expect(r.derivative).toBeCloseTo(numeric, 5);
            }
        });
    });

    it("keeps negative outputs small and positive outputs unchanged", () => {
        const r = leakyReluFor(-5, 0.01);
        expect(r.value).toBeCloseTo(-0.05, 10);
        expect(r.derivative).toBeCloseTo(0.01, 10);
        expect(leakyReluFor(5, 0.01).value).toBe(5);
        expect(leakyReluFor(5, 0.01).derivative).toBe(1);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});

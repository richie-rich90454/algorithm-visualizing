/** elu-activation.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, { eluFor } from "./elu-activation";
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

describe("Exponential Linear Unit", () => {
    it("matches an independent reference and finite differences", () => {
        const input = mod.defaultInput as { values: number[]; alpha: number };
        const alpha = input.alpha;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.values.length);
        const final = frames[frames.length - 1]?.meta["values"] as number[];
        input.values.forEach((x, i) => {
            const expected = x > 0 ? x : alpha * (Math.exp(x) - 1);
            expect(final[i]).toBeCloseTo(expected, 10);
            const r = eluFor(x, alpha);
            expect(r.value).toBeCloseTo(expected, 10);
            if (Math.abs(x) > 1e-6) {
                const h = 1e-5;
                const numeric = (eluFor(x + h, alpha).value - eluFor(x - h, alpha).value) / (2 * h);
                expect(r.derivative).toBeCloseTo(numeric, 4);
            }
        });
    });

    it("saturates negative inputs near minus alpha", () => {
        expect(eluFor(-20, 1).value).toBeCloseTo(-1, 6);
        expect(eluFor(0, 1).value).toBe(0);
        expect(eluFor(3, 1).derivative).toBe(1);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});

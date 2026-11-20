/** selu-activation.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, { SELU_ALPHA, SELU_SCALE, seluFor } from "./selu-activation";
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
    });
}

describe("Scaled Exponential Linear Unit", () => {
    it("matches an independent reference and finite differences", () => {
        const input = mod.defaultInput as { values: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.values.length);
        const final = frames[frames.length - 1]?.meta["values"] as number[];
        input.values.forEach((x, i) => {
            const inner = x > 0 ? x : SELU_ALPHA * (Math.exp(x) - 1);
            const expected = SELU_SCALE * inner;
            expect(final[i]).toBeCloseTo(expected, 10);
            const r = seluFor(x);
            expect(r.value).toBeCloseTo(expected, 10);
            if (Math.abs(x) > 1e-6) {
                const h = 1e-5;
                const numeric = (seluFor(x + h).value - seluFor(x - h).value) / (2 * h);
                expect(r.derivative).toBeCloseTo(numeric, 4);
            }
        });
    });

    it("uses the canonical self-normalizing constants", () => {
        expect(SELU_ALPHA).toBeCloseTo(1.6732632423543772, 10);
        expect(SELU_SCALE).toBeCloseTo(1.0507009873554805, 10);
        expect(seluFor(1).value).toBeCloseTo(SELU_SCALE, 10);
        expect(seluFor(0).value).toBeCloseTo(0, 12);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});

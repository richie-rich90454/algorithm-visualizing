/** pinball-loss.test.ts - Check-function definition, median reduction, and frame checks. */

import { describe, expect, it } from "vitest";
import mod, { pinballFor } from "./pinball-loss";
import type { VisualFrame } from "@/types";

interface Input {
    predictions: number[];
    targets: number[];
    tau: number;
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBe(rows + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Pinball Loss", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force evaluation of the check function", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.predictions.length);
        const got = frames[frames.length - 1]?.meta["losses"] as number[];
        input.predictions.forEach((prediction, i) => {
            const r = (input.targets[i] ?? 0) - prediction;
            const expected = r >= 0 ? input.tau * r : (input.tau - 1) * r;
            expect(got[i]).toBeCloseTo(expected, 12);
        });
    });

    it("reduces to half absolute error at tau one half", () => {
        for (const r of [-3, -0.5, 0, 0.5, 3]) {
            expect(pinballFor(r, 0.5).loss).toBeCloseTo(0.5 * Math.abs(r), 12);
        }
    });

    it("is nonnegative with slopes tau and tau minus one", () => {
        for (const tau of [0.1, 0.3, 0.7, 0.9]) {
            expect(pinballFor(2, tau).loss).toBeCloseTo(tau * 2, 12);
            expect(pinballFor(-2, tau).loss).toBeCloseTo((tau - 1) * -2, 12);
            expect(pinballFor(2, tau).loss).toBeGreaterThanOrEqual(0);
            expect(pinballFor(-2, tau).loss).toBeGreaterThanOrEqual(0);
        }
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

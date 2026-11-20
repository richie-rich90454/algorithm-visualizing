/** sarah-optimizer.test.ts - Optimum, variance, frame and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./sarah-optimizer";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(1);
        expect(frame.entities[0]?.type).toBe("bar");
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SARAH Optimizer", () => {
    it("converges to the analytic optimum on the default finite sum", () => {
        const input = mod.defaultInput as { components: Array<{ a: number; b: number }> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const optimum = input.components.reduce((s, c) => s + c.b, 0) / input.components.reduce((s, c) => s + c.a, 0);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["optimum"]).toBeCloseTo(optimum, 12);
        expect(meta?.["x"]).toBeCloseTo(optimum, 4);
    });

    it("beats plain stochastic gradient descent and reduces the objective", () => {
        const components = [
            { a: 2, b: 3 },
            { a: 1, b: 1 },
            { a: 4, b: 6 },
            { a: 3, b: 2 },
        ];
        const frames = [...mod.run({ components, start: 8, learningRate: 0.1, epochs: 40, inner: 4 })];
        const startObjective = frames[0]?.meta["objective"] as number;
        const endObjective = frames[frames.length - 1]?.meta["objective"] as number;
        expect(endObjective).toBeLessThan(startObjective);

        const sgd = [...mod.run({ components, start: 8, learningRate: 0.1, epochs: 40, inner: 1 })];
        const sgdError = (sgd[sgd.length - 1]?.meta["error"] as number);
        const sarahError = frames[frames.length - 1]?.meta["error"] as number;
        expect(sarahError).toBeLessThan(sgdError + 1e-6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

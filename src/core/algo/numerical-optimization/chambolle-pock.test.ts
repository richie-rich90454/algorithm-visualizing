/** chambolle-pock.test.ts - Closed-form cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./chambolle-pock";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent soft-threshold solution of the diagonal penalized problem. */
function reference(a: number[], b: number[], lambda: number): number[] {
    return a.map((ai, index) => {
        const product = ai * (b[index] ?? 0);
        if (Math.abs(product) <= lambda || ai === 0) return 0;
        return (product - Math.sign(product) * lambda) / (ai * ai);
    });
}

describe("Chambolle-Pock", () => {
    it("converges to the closed-form soft-threshold solution", () => {
        for (const lambda of [0, 0.4, 0.8, 2]) {
            const input = { a: [1, 2, 0.5, 3], b: [2, -1, 4, 1], lambda, iterations: 600 };
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const primal = frames[frames.length - 1]?.meta["primal"] as number[];
            const expected = reference(input.a, input.b, lambda);
            expected.forEach((value, index) => expect(primal[index] ?? 0).toBeCloseTo(value ?? 0, 3));
        }
    });

    it("decreases the objective monotonically across reported frames", () => {
        const frames = [...mod.run({ iterations: 120 })];
        checkFrames(frames);
        const objectives = frames.map((frame) => Number(frame.meta["objective"]));
        for (let index = 1; index < objectives.length; index += 1) {
            expect(objectives[index] ?? Infinity).toBeLessThanOrEqual((objectives[index - 1] ?? Infinity) + 1e-6);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(5);
        expect(generator.next().done).toBe(true);
    });
});

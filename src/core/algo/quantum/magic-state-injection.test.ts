/**
 * magic-state-injection.test.ts - Gate fidelity, branch probabilities, and frames.
 */

import { describe, expect, it } from "vitest";
import mod from "./magic-state-injection";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Magic state injection", () => {
    it("implements T up to global phase on both outcomes for several inputs", () => {
        const cases: Array<[[number, number], [number, number]]> = [
            [[1, 0], [0, 0]],
            [[0, 0], [1, 0]],
            [[1 / Math.SQRT2, 0], [1 / Math.SQRT2, 0]],
            [[1 / Math.SQRT2, 0], [0, 1 / Math.SQRT2]],
        ];
        for (const data of cases) {
            const frames = [...mod.run({ data })];
            checkFrames(frames);
            const zero = frames[2]?.meta;
            const one = frames[4]?.meta;
            expect(Number(zero?.["fidelity"])).toBeCloseTo(1, 9);
            expect(Number(one?.["fidelity"])).toBeCloseTo(1, 9);
            expect(zero?.["outcome"]).toBe(0);
            expect(one?.["outcome"]).toBe(1);
            expect(one?.["correction"]).toBe("S");
        }
    });

    it("reports branch probabilities that sum to one", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const total =
            Number(frames[2]?.meta["probability"]) + Number(frames[3]?.meta["probability"]);
        expect(total).toBeCloseTo(1, 9);
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

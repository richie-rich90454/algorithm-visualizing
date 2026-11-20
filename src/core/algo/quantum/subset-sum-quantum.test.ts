/**
 * subset-sum-quantum.test.ts - Quantum subset-sum search correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./subset-sum-quantum";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Exhaustively count subsets summing to the target. */
function bruteSolutions(values: number[], target: number): number {
    let count = 0;
    for (let mask = 0; mask < 2 ** values.length; mask += 1) {
        let sum = 0;
        for (let i = 0; i < values.length; i += 1) {
            if (((mask >> i) & 1) === 1) {
                sum += values[i] as number;
            }
        }
        if (sum === target) {
            count += 1;
        }
    }
    return count;
}

describe("Quantum Subset Sum Search", () => {
    it("returns a subset whose sum equals the target", () => {
        const input = mod.defaultInput as { values: number[]; target: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const chosen = final?.["chosen"] as number[];
        expect(final?.["found"]).toBe(true);
        const sum = chosen.reduce((s, i) => s + (input.values[i] as number), 0);
        expect(sum).toBe(input.target);
        expect(sum).toBe(Number(final?.["sum"]));
        expect(Number(final?.["marked"])).toBe(bruteSolutions(input.values, input.target));
    });

    it("handles several solvable and unsolvable instances", () => {
        const cases = [
            { values: [2, 4, 6], target: 6, solvable: true },
            { values: [1, 3, 5, 7], target: 12, solvable: true },
            { values: [2, 2, 2], target: 7, solvable: false },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["found"]).toBe(testCase.solvable);
            expect(Number(final?.["marked"])).toBe(bruteSolutions(testCase.values, testCase.target));
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

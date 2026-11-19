/**
 * hawk-dove.test.ts - Independent equilibrium verification and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./hawk-dove";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.length).toBe(4);
    }
}

function payoff(v: number, c: number, i: number, j: number): [number, number] {
    if (i === 0 && j === 0) {
        return [(v - c) / 2, (v - c) / 2];
    }
    if (i === 0 && j === 1) {
        return [v, 0];
    }
    if (i === 1 && j === 0) {
        return [0, v];
    }
    return [v / 2, v / 2];
}

function referencePure(v: number, c: number): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
            const self = payoff(v, c, i, j);
            const deviateRow = payoff(v, c, 1 - i, j)[0];
            const deviateCol = payoff(v, c, i, 1 - j)[1];
            if (self[0] >= deviateRow && self[1] >= deviateCol) {
                out.push([i, j]);
            }
        }
    }
    return out;
}

describe("Hawk-Dove Game", () => {
    it("finds the correct pure equilibria and mixed probability", () => {
        const input = mod.defaultInput as { v: number; c: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const mixedFrame = frames.find((f) => typeof f.meta["mixedP"] === "number");
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["pureNE"]).toEqual(referencePure(input.v, input.c).flat());
        const p = mixedFrame?.meta["mixedP"] as number;
        expect(p).toBeCloseTo(input.v / input.c, 10);
        const hawk = p * payoff(input.v, input.c, 0, 0)[0] + (1 - p) * payoff(input.v, input.c, 0, 1)[0];
        const dove = p * payoff(input.v, input.c, 1, 0)[0] + (1 - p) * payoff(input.v, input.c, 1, 1)[0];
        expect(hawk).toBeCloseTo(dove, 10);
        expect(mixedFrame?.meta["mixedPayoff"]).toBeCloseTo(dove, 10);
    });

    it("handles the high-value and equal-value regimes", () => {
        const cases = [
            { v: 6, c: 4 },
            { v: 3, c: 3 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ v: testCase.v, c: testCase.c })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["pureNE"]).toEqual(referencePure(testCase.v, testCase.c).flat());
            const p = frames.find((f) => typeof f.meta["mixedP"] === "number")?.meta["mixedP"] as number;
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
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

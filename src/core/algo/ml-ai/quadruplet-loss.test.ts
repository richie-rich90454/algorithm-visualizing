/** quadruplet-loss.test.ts - Brute-force distance and hinge checks. */

import { describe, expect, it } from "vitest";
import mod from "./quadruplet-loss";
import type { VisualFrame } from "@/types";

interface Input {
    anchor: number[];
    positive: number[];
    negative1: number[];
    negative2: number[];
    margin1: number;
    margin2: number;
}

function sqDist(a: number[], b: number[]): number {
    return a.reduce((s, v, i) => s + (v - (b[i] ?? 0)) ** 2, 0);
}

function reference(input: Input) {
    const dAP = sqDist(input.anchor, input.positive);
    const dAN1 = sqDist(input.anchor, input.negative1);
    const dAN2 = sqDist(input.anchor, input.negative2);
    const term1 = Math.max(0, dAP - dAN1 + input.margin1);
    const term2 = Math.max(0, dAP - dAN2 + input.margin2);
    return { dAP, dAN1, dAN2, term1, term2, total: term1 + term2 };
}

function checkFrames(frames: VisualFrame[], dim: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4 * dim);
        expect(frame.entities.every((e) => e.id.length > 0 && Number.isFinite(e.value as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Quadruplet loss", () => {
    const input = mod.defaultInput as Input;

    it("matches a direct distance and hinge computation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.anchor.length);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        for (const key of ["dAP", "dAN1", "dAN2", "term1", "term2", "total"] as const) {
            expect(Number(final?.[key])).toBeCloseTo(expected[key], 9);
        }
        expect(expected.total).toBeGreaterThan(0);
    });

    it("returns zero when both margins are satisfied", () => {
        const easy: Input = {
            anchor: [0, 0],
            positive: [1, 0],
            negative1: [5, 0],
            negative2: [6, 0],
            margin1: 0.5,
            margin2: 0.5,
        };
        const frames = [...mod.run(easy)];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["total"])).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

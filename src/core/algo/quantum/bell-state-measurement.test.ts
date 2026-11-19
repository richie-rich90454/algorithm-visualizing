/**
 * bell-state-measurement.test.ts - Bell basis mapping, unitarity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bell-state-measurement";
import type { VisualFrame } from "@/types";

const EXPECTED: Record<string, number> = {
    "phi-plus": 0,
    "psi-plus": 1,
    "phi-minus": 2,
    "psi-minus": 3,
};

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["norm"] as number).toBeCloseTo(1, 12);
        expect(frame.meta["gateCount"]).toBe(index);
    });
}

describe("BellStateMeasurement", () => {
    it("maps each Bell state to the correct certain outcome", () => {
        const outcomes: number[] = [];
        for (const bell of Object.keys(EXPECTED)) {
            const frames = [...mod.run({ bell })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["outcome"]).toBe(EXPECTED[bell]);
            expect(final?.["outcomeBits"]).toBe(["00", "01", "10", "11"][EXPECTED[bell]]);
            expect(final?.["matched"]).toBe(true);
            const probs = final?.["probabilities"] as number[];
            probs.forEach((prob, i) => expect(prob).toBeCloseTo(i === EXPECTED[bell] ? 1 : 0, 12));
            outcomes.push(final?.["outcome"] as number);
        }
        expect(new Set(outcomes).size).toBe(4);
    });

    it("preserves the state norm through both unitary gates", () => {
        const frames = [...mod.run({ bell: "phi-minus" })];
        frames.forEach((frame) => {
            const amplitudes = frame.meta["amplitudes"] as number[];
            expect(amplitudes.reduce((sum, a) => sum + a * a, 0)).toBeCloseTo(1, 12);
        });
        const afterCnot = frames[1]?.meta["amplitudes"] as number[];
        expect(afterCnot[2]).toBeCloseTo(-Math.SQRT1_2, 12);
        expect(afterCnot[3]).toBeCloseTo(0, 12);
        const afterHadamard = frames[2]?.meta["amplitudes"] as number[];
        expect(afterHadamard[2]).toBeCloseTo(1, 12);
    });

    it("rejects an unknown bell label by using the default state", () => {
        const frames = [...mod.run({ bell: "unknown" })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["bell"]).toBe("phi-plus");
        expect(final?.["outcome"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});

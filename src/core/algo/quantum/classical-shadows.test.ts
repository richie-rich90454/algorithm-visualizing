/**
 * classical-shadows.test.ts - Exact reconstruction of the Bell density matrix,
 * known observable expectations, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./classical-shadows";
import type { VisualFrame, MetaValue } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function expectation(meta: Record<string, MetaValue>, key: string): number[] {
    const raw = meta[key];
    return Array.isArray(raw) ? raw.map((v) => Number(v)) : [];
}

function estimate(meta: Record<string, MetaValue>): number[][][] {
    const raw = meta["estimate"];
    return Array.isArray(raw)
        ? raw.map((row) => (row as MetaValue[]).map((z) => (z as MetaValue[]).map((v) => Number(v))))
        : [];
}

describe("Classical shadows", () => {
    it("reconstructs the Bell density matrix entry by entry", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const m = estimate(final);
        expect(m.length).toBe(4);
        for (const row of m) expect(row.length).toBe(4);
        const expected: Array<Array<[number, number]>> = [
            [[0.5, 0], [0, 0], [0, 0], [0.5, 0]],
            [[0, 0], [0, 0], [0, 0], [0, 0]],
            [[0, 0], [0, 0], [0, 0], [0, 0]],
            [[0.5, 0], [0, 0], [0, 0], [0.5, 0]],
        ];
        for (let i = 0; i < 4; i += 1) {
            for (let j = 0; j < 4; j += 1) {
                expect(m[i]![j]![0]).toBeCloseTo(expected[i]![j]![0], 8);
                expect(m[i]![j]![1]).toBeCloseTo(expected[i]![j]![1], 8);
            }
        }
        expect(Number(final["maxError"])).toBeLessThan(1e-9);
        expect(final["done"]).toBe(true);
    });

    it("reports the known Bell observable expectations", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const values = expectation(final, "expectation");
        expect(values[0]).toBeCloseTo(1, 8);
        expect(values[1]).toBeCloseTo(1, 8);
        expect(values[2]).toBeCloseTo(-1, 8);
        expect(values[3]).toBeCloseTo(1, 8);
        for (const value of expectation(final, "trueExpectation")) {
            expect(Number.isFinite(value)).toBe(true);
        }
    });

    it("converges monotonically in the enumerated average", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const errors = frames.slice(1, -1).map((f) => Number(f.meta["maxError"]));
        expect(errors.length).toBeGreaterThan(3);
        for (let i = 1; i < errors.length; i += 1) {
            expect(errors[i]!).toBeLessThanOrEqual(errors[i - 1]! + 1e-12);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

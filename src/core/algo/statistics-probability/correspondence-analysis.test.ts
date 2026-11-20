/**
 * correspondence-analysis.test.ts - Closed-form 2x2 inertia, trace identity, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./correspondence-analysis";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], dimensions: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(dimensions);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Correspondence Analysis", () => {
    it("matches the closed-form inertia of a 2x2 table", () => {
        const table = [
            [10, 20],
            [20, 10],
        ];
        const frames = [...mod.run({ table })];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1];
        const inertia = final?.meta["inertia"] as number[];
        const expected = Math.pow(10 * 10 - 20 * 20, 2) / (30 * 30 * 30 * 30);
        expect(inertia[0] as number).toBeCloseTo(expected, 10);
        expect(inertia[1] as number).toBeCloseTo(0, 10);
        expect(final?.meta["totalInertia"] as number).toBeCloseTo(expected, 10);
        expect(final?.meta["chiSquare"] as number).toBeCloseTo(60 * expected, 8);
    });

    it("has inertias summing to chi-square over the grand total with centered coordinates", () => {
        const table = [
            [23, 9, 6, 12],
            [11, 12, 7, 20],
            [6, 9, 14, 11],
            [15, 5, 9, 21],
        ];
        const final = [...mod.run({ table })].at(-1);
        const inertia = final?.meta["inertia"] as number[];
        const grand = table.flat().reduce((a, b) => a + b, 0);
        const r = table.map((row) => row.reduce((a, b) => a + b, 0) / grand);
        const c = Array.from({ length: 4 }, (_, j) => table.reduce((a, row) => a + row[j] as number, 0) / grand);
        let expected = 0;
        for (let i = 0; i < 4; i += 1) {
            for (let j = 0; j < 4; j += 1) {
                const observed = (table[i]?.[j] as number) / grand;
                expected += grand * Math.pow(observed - (r[i] as number) * (c[j] as number), 2) / ((r[i] as number) * (c[j] as number));
            }
        }
        expect(final?.meta["chiSquare"] as number).toBeCloseTo(expected, 8);
        expect(final?.meta["totalInertia"] as number).toBeCloseTo(expected / grand, 8);
        expect(inertia.reduce((a, b) => a + b, 0)).toBeCloseTo(expected / grand, 8);
        const rowCoords = final?.meta["rowCoords"] as number[][];
        for (let d = 0; d < 4; d += 1) {
            let weighted = 0;
            for (let i = 0; i < 4; i += 1) weighted += (r[i] as number) * (rowCoords[i]?.[d] as number);
            expect(weighted).toBeCloseTo(0, 6);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

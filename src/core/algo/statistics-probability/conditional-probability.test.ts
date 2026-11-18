/**
 * conditional-probability.test.ts - Brute-force sample expansion, frame shape,
 * termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./conditional-probability";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], table: number[][]): void {
    const rows = table.length;
    const cols = table[0]?.length ?? 0;
    expect(frames.length).toBe(rows + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(cols);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Expand counts into a flat population and count outcomes directly. */
function bruteForce(table: number[][], givenColumn: number): number[] {
    const population: Array<{ row: number; col: number }> = [];
    table.forEach((row, r) =>
        row.forEach((count, c) => {
            for (let k = 0; k < count; k += 1) {
                population.push({ row: r, col: c });
            }
        }),
    );
    const restricted = population.filter((item) => item.col === givenColumn);
    return table.map((_row, r) => {
        const both = restricted.filter((item) => item.row === r).length;
        return restricted.length === 0 ? 0 : both / restricted.length;
    });
}

describe("ConditionalProbability", () => {
    it("matches enumeration of an expanded population", () => {
        const cases: Array<{ table: number[][]; givenColumn: number }> = [
            { table: [[80, 10], [5, 20]], givenColumn: 1 },
            { table: [[30, 12], [8, 40]], givenColumn: 0 },
            { table: [[2, 3, 5], [7, 1, 4], [0, 6, 2]], givenColumn: 2 },
            { table: [[10, 20, 30, 40]], givenColumn: 3 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.table);
            const result = frames[frames.length - 1]?.meta["conditionals"] as number[];
            const expected = bruteForce(testCase.table, testCase.givenColumn);
            expect(result.length).toBe(expected.length);
            for (let r = 0; r < expected.length; r += 1) {
                expect(result[r]).toBeCloseTo(expected[r]!, 12);
            }
            expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        }
    });

    it("handles an empty column without dividing by zero", () => {
        const frames = [...mod.run({ table: [[5, 0], [3, 0]], givenColumn: 1 })];
        checkFrames(frames, [[5, 0], [3, 0]]);
        expect(frames[frames.length - 1]?.meta["conditionals"]).toEqual([0, 0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});

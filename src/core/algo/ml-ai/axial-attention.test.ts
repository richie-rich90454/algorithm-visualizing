/** axial-attention.test.ts - Brute-force two-pass check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { axialAttention } from "./axial-attention";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(cols);
    });
}

function attend(values: number[], target: number): number {
    const scores = values.map((v) => v * target);
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return values.reduce((acc, v, i) => acc + (exps[i] ?? 0) / sum * v, 0);
}

describe("Axial Attention", () => {
    const grid = (mod.defaultInput as { grid: number[][] }).grid;

    it("matches a brute-force row pass then column pass", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const rows = grid.length;
        const cols = grid[0]?.length ?? 0;
        checkFrames(frames, rows, cols);
        const rowPass = grid.map((row) => row.map((_, c) => attend(row, row[c] ?? 0)));
        const expected = rowPass.map((row, r) => row.map((_, c) => {
            const column = rowPass.map((rr) => rr[c] ?? 0);
            return attend(column, column[r] ?? 0);
        }));
        const flat = frames[frames.length - 1]?.meta["output"] as number[];
        const outCols = (frames[frames.length - 1]?.meta["outCols"] as number) ?? cols;
        const got = (r: number, c: number) => flat[r * outCols + c] ?? 0;
        expected.forEach((row, r) => row.forEach((v, c) => expect(got(r, c)).toBeCloseTo(v, 12)));
        const helper = axialAttention(grid);
        helper.columnAttention.forEach((row, r) => row.forEach((v, c) => expect(got(r, c)).toBeCloseTo(v, 12)));
    });

    it("keeps each row pass independent of other rows", () => {
        const result = axialAttention(grid);
        const single = axialAttention([grid[0] ?? []]);
        result.rowAttention[0]?.forEach((v, c) => expect(v).toBeCloseTo(single.rowAttention[0]?.[c] ?? 0, 12));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

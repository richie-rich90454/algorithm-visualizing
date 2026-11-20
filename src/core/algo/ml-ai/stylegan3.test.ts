/**
 * stylegan3.test.ts - Translation-equivariance property check, frame shape,
 * and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./stylegan3";
import type { VisualFrame } from "@/types";

function makeSignal(n: number): number[][] {
    const signal: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        signal.push([]);
        for (let j = 0; j < n; j += 1) {
            signal[i]?.push(
                Math.cos((2 * Math.PI * i) / n) + 0.5 * Math.cos((2 * Math.PI * j) / n),
            );
        }
    }
    return signal;
}

function shiftLeft(signal: number[][]): number[][] {
    const n = signal.length;
    return signal.map((row) => {
        const shifted: number[] = [];
        for (let x = 0; x < n; x += 1) {
            shifted.push(row[(x - 1 + n) % n] ?? 0);
        }
        return shifted;
    });
}

/** Read a frame's cell grid back into a two-dimensional number array. */
function readGrid(frame: VisualFrame | undefined): number[][] {
    const grid: number[][] = [];
    for (const entity of frame?.entities ?? []) {
        const row = Number(entity.metadata["row"]);
        const col = Number(entity.metadata["col"]);
        grid[row] = grid[row] ?? [];
        grid[row][col] = Number(entity.metadata["value"]);
    }
    return grid;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBeDefined();
        expect(frame.meta["cols"]).toBeDefined();
    });
}

describe("StyleGAN3 alias-free upsampling", () => {
    it("is equivariant to a one-sample input shift at twice the output scale", () => {
        const n = 8;
        const signal = makeSignal(n);
        const original = [...mod.run({ signal, cutoff: 0.5 })];
        const shifted = [...mod.run({ signal: shiftLeft(signal), cutoff: 0.5 })];
        checkFrames(original);
        checkFrames(shifted);

        const up = readGrid(original[original.length - 1]);
        const upShifted = readGrid(shifted[shifted.length - 1]);
        const m = 2 * n;
        expect(up.length).toBe(m);
        expect(upShifted.length).toBe(m);

        let maxDiff = 0;
        for (let row = 0; row < m; row += 1) {
            for (let col = 0; col < m; col += 1) {
                const actual = upShifted[row]?.[col] ?? 0;
                const expected = up[row]?.[(col - 2 + m) % m] ?? 0;
                maxDiff = Math.max(maxDiff, Math.abs(actual - expected));
            }
        }
        expect(maxDiff).toBeLessThan(1e-6);
        expect(original[original.length - 1]?.meta["equivariant"]).toBe(true);
    });

    it("keeps exactly the bandlimited frequencies inside the cutoff disk", () => {
        const frames = [...mod.run({ signal: makeSignal(8), cutoff: 0.5 })];
        const maskFrame = frames[1];
        expect(maskFrame?.meta["kept"]).toBe(13);
        const keptCells = maskFrame?.entities.filter(
            (entity) => entity.metadata["value"] === 1,
        ).length;
        expect(keptCells).toBe(13);
    });

    it("preserves a constant signal through upsampling", () => {
        const n = 8;
        const constant = Array.from({ length: n }, () => Array.from({ length: n }, () => 2.5));
        const frames = [...mod.run({ signal: constant, cutoff: 0.5 })];
        const output = readGrid(frames[frames.length - 1]);
        expect(output.length).toBe(2 * n);
        for (const row of output) {
            for (const value of row) {
                expect(value).toBeCloseTo(2.5, 6);
            }
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

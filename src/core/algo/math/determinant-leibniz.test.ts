import { describe, expect, it } from "vitest";
import mod from "./determinant-leibniz";
import type { VisualFrame } from "@/types";

function determinantReference(matrix: number[][]): number {
    const n = matrix.length;
    const a = matrix.map((row) => row.slice());
    let determinant = 1;
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(a[row]?.[col] ?? 0) > Math.abs(a[pivot]?.[col] ?? 0)) {
                pivot = row;
            }
        }
        if ((a[pivot]?.[col] ?? 0) === 0) {
            return 0;
        }
        if (pivot !== col) {
            const temp = a[col]!;
            a[col] = a[pivot]!;
            a[pivot] = temp;
            determinant = -determinant;
        }
        const pivotValue = a[col]![col]!;
        determinant *= pivotValue;
        for (let row = col + 1; row < n; row += 1) {
            const factor = (a[row]![col] ?? 0) / pivotValue;
            for (let j = col; j < n; j += 1) {
                a[row]![j] = (a[row]![j] ?? 0) - factor * (a[col]![j] ?? 0);
            }
        }
    }
    return Math.round(determinant);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Determinant by Leibniz Formula", () => {
    it("matches Gaussian elimination on small integer matrices", () => {
        let seed = 424242;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (let trial = 0; trial < 20; trial += 1) {
            const size = 2 + (trial % 4);
            const matrix = Array.from({ length: size }, () =>
                Array.from({ length: size }, () => (next() % 11) - 5),
            );
            const frames = [...mod.run({ matrix, frameLimit: 500 })];
            checkFrames(frames);
            expect(Number(frames[frames.length - 1]?.meta["determinant"])).toBe(determinantReference(matrix));
        }
    });

    it("handles identity, singular, and the default matrix", () => {
        const identity = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ];
        const singular = [
            [1, 2, 3],
            [2, 4, 6],
            [7, 8, 9],
        ];
        const identityFrames = [...mod.run({ matrix: identity })];
        expect(Number(identityFrames[identityFrames.length - 1]?.meta["determinant"])).toBe(1);
        const singularFrames = [...mod.run({ matrix: singular })];
        expect(Number(singularFrames[singularFrames.length - 1]?.meta["determinant"])).toBe(0);
        const defaultFrames = [...mod.run(mod.defaultInput)];
        expect(Number(defaultFrames[defaultFrames.length - 1]?.meta["determinant"])).toBe(-3);
    });

    it("caps emitted frames but visits every permutation", () => {
        const matrix = [
            [1, 2, 3, 4],
            [5, 6, 7, 8],
            [9, 10, 11, 12],
            [13, 14, 15, 17],
        ];
        const frames = [...mod.run({ matrix, frameLimit: 10 })];
        checkFrames(frames);
        expect(Number(frames[frames.length - 1]?.meta["terms"])).toBe(24);
        expect(frames.length).toBeLessThanOrEqual(13);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

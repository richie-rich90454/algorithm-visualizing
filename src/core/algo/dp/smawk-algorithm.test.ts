import { describe, expect, it } from "vitest";
import mod from "./smawk-algorithm";

/** Brute-force first argmin of every row. */
function bruteMinima(matrix: number[][]): number[] {
    return matrix.map((row) => {
        let bestIndex = 0;
        let bestValue = row[0] as number;
        for (let j = 1; j < row.length; j += 1) {
            if ((row[j] as number) < bestValue) {
                bestValue = row[j] as number;
                bestIndex = j;
            }
        }
        return bestIndex;
    });
}

function framesFor(matrix: number[][]) {
    return [...mod.run({ matrix })];
}

describe("SmawkAlgorithm", () => {
    it("finds exactly the brute-force row minima on Monge matrices", () => {
        const matrices: number[][][] = [];
        for (const [rows, cols] of [
            [1, 1],
            [1, 6],
            [4, 5],
            [6, 6],
            [5, 9],
            [8, 3],
        ]) {
            matrices.push(
                Array.from({ length: rows }, (_, i) =>
                    Array.from({ length: cols }, (_, j) => (i - j) * (i - j)),
                ),
            );
            matrices.push(
                Array.from({ length: rows }, (_, i) =>
                    Array.from({ length: cols }, (_, j) => Math.abs(i - j) + 5 * i),
                ),
            );
        }
        for (const matrix of matrices) {
            const frames = framesFor(matrix);
            const last = frames[frames.length - 1];
            expect(last?.meta.minima, `matrix ${matrix.length}x${matrix[0]?.length}`).toEqual(
                bruteMinima(matrix),
            );
        }
    });

    it("emits well-formed grid frames with sequential step numbers", () => {
        const frames = framesFor(
            Array.from({ length: 4 }, (_, i) =>
                Array.from({ length: 5 }, (_, j) => (i - j) * (i - j)),
            ),
        );
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.layout).toBe("grid");
            expect(frame.entities.length).toBe(20);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect((mod.pseudocode ?? []).length).toBeGreaterThan(frame.codeLineNumber ?? 0);
            expect(frame.meta.rows).toBe(4);
            expect(frame.meta.cols).toBe(5);
            for (const entity of frame.entities) {
                expect(entity.type).toBe("cell");
            }
        });
    });

    it("terminates cleanly on an empty matrix", () => {
        const generator = mod.run({ matrix: [] });
        let count = 0;
        let result = generator.next();
        while (!result.done) {
            count += 1;
            result = generator.next();
        }
        expect(count).toBe(1);
    });
});

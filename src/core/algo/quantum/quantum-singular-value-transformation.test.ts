/**
 * quantum-singular-value-transformation.test.ts - Spectral correctness checks
 * against independent matrix identities, plus frame shape and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-singular-value-transformation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    }
}

function finalMeta(a: number, b: number, c: number, d: number, coefficients: number[]) {
    const frames = [...mod.run({ a, b, c, d, coefficients })];
    checkFrames(frames);
    return frames[frames.length - 1]?.meta;
}

function near(actual: number | undefined, expected: number, tolerance = 1e-6): void {
    expect(typeof actual).toBe("number");
    expect(Math.abs((actual ?? 0) - expected)).toBeLessThan(tolerance);
}

function matrixProduct(m: number[], n: number[]): number[] {
    return [
        m[0]! * n[0]! + m[1]! * n[2]!,
        m[0]! * n[1]! + m[1]! * n[3]!,
        m[2]! * n[0]! + m[3]! * n[2]!,
        m[2]! * n[1]! + m[3]! * n[3]!,
    ];
}

function gramEigenvalues(m: number[]): number[] {
    const [a, b, c, d] = m;
    const p = a! * a! + c! * c!;
    const q = a! * b! + c! * d!;
    const r = b! * b! + d! * d!;
    const trace = p + r;
    const discriminant = Math.sqrt((p - r) * (p - r) + 4 * q * q);
    return [(trace + discriminant) / 2, (trace - discriminant) / 2];
}

describe("Quantum Singular Value Transformation", () => {
    it("leaves the matrix unchanged for f(x) = x", () => {
        const input = [2, -1, 0.5, 3];
        const meta = finalMeta(input[0]!, input[1]!, input[2]!, input[3]!, [0, 1]);
        const transformed = meta?.["transformedMatrix"] as number[];
        for (let i = 0; i < 4; i += 1) {
            near(transformed[i], input[i]!);
        }
    });

    it("equals A times A-transpose A for f(x) = x cubed on varied matrices", () => {
        const cases = [
            [3, 1, 1, 3],
            [2, 0, 0, -5],
            [1, 2, 3, 4],
            [-2, 1, 0.5, 3],
        ];
        for (const matrix of cases) {
            const meta = finalMeta(matrix[0]!, matrix[1]!, matrix[2]!, matrix[3]!, [0, 0, 0, 1]);
            const transformed = meta?.["transformedMatrix"] as number[];
            const gram = matrixProduct(
                [matrix[0]!, matrix[2]!, matrix[1]!, matrix[3]!],
                matrix,
            );
            const expected = matrixProduct(matrix, gram);
            for (let i = 0; i < 4; i += 1) {
                near(transformed[i], expected[i]!, 1e-6);
            }
        }
    });

    it("maps the transformed singular values to the polynomial images", () => {
        const matrix = [1, 2, 3, 4];
        const coefficients = [0, 0, 0, 1];
        const meta = finalMeta(matrix[0]!, matrix[1]!, matrix[2]!, matrix[3]!, coefficients);
        const original = meta?.["singularValues"] as number[];
        const transformed = meta?.["transformedSingularValues"] as number[];
        for (let i = 0; i < 2; i += 1) {
            near(transformed[i], original[i]! ** 3);
        }
        const transformedMatrix = meta?.["transformedMatrix"] as number[];
        const eigen = gramEigenvalues(transformedMatrix).sort((x, y) => y - x);
        for (let i = 0; i < 2; i += 1) {
            near(eigen[i], transformed[i]! ** 2, 1e-5);
        }
    });

    it("produces the zero matrix for the zero polynomial", () => {
        const meta = finalMeta(3, 1, 1, 3, [0]);
        const transformed = meta?.["transformedMatrix"] as number[];
        expect(transformed.every((value) => Math.abs(value) < 1e-9)).toBe(true);
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

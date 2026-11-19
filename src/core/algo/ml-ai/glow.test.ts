/** glow.test.ts - Brute-force ActNorm and 1x1 convolution math, invertibility, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./glow";
import type { VisualFrame } from "@/types";

interface Input {
    x: number[];
    matrix: number[];
    actScale: number[];
    actBias: number[];
}

function reference(input: Input) {
    const [a, b, c, d] = input.matrix;
    const det = a! * d! - b! * c!;
    const y = input.x.map((v, i) => v * input.actScale[i]! + input.actBias[i]!);
    const z = [a! * y[0]! + b! * y[1]!, c! * y[0]! + d! * y[1]!];
    const logDet =
        input.actScale.reduce((sum, s) => sum + Math.log(Math.abs(s) || 1e-12), 0) +
        Math.log(Math.abs(det) || 1e-12);
    return { y, z, det, logDet };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Glow invertible 1x1 convolution", () => {
    const cases: Input[] = [
        { x: [1, 2], matrix: [1.2, 0.4, -0.3, 0.9], actScale: [1.5, 0.8], actBias: [0.2, -0.1] },
        { x: [-2, 3], matrix: [0, 1, 1, 0], actScale: [2, 2], actBias: [0, 0] },
        { x: [0.5, -0.5], matrix: [3, 0, 0, 0.25], actScale: [1, 1], actBias: [1, -1] },
        mod.defaultInput as Input,
    ];

    it("matches a brute-force ActNorm then 1x1 convolution", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            const out = final?.["vector"] as number[];
            out.forEach((value, i) => expect(value).toBeCloseTo(expected.z[i]!, 6));
            expect(Number(final?.["det"])).toBeCloseTo(expected.det, 9);
            expect(Number(final?.["logDet"])).toBeCloseTo(expected.logDet, 6);
        }
    });

    it("log determinant equals sum of log scales plus log determinant of the matrix", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const final = frames[frames.length - 1]?.meta;
            const expected =
                input.actScale.reduce((sum, s) => sum + Math.log(Math.abs(s) || 1e-12), 0) +
                Math.log(Math.abs(input.matrix[0]! * input.matrix[3]! - input.matrix[1]! * input.matrix[2]!) || 1e-12);
            expect(Number(final?.["logDet"])).toBeCloseTo(expected, 6);
        }
    });

    it("reverses to the original input", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const final = frames[frames.length - 1]?.meta;
            expect(Boolean(final?.["converged"])).toBe(true);
            expect(Number(final?.["inverseError"])).toBeLessThan(1e-8);
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

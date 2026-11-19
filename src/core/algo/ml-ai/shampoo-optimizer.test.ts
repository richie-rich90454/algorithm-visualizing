/** shampoo-optimizer.test.ts - Independent replay, diagonal sign property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./shampoo-optimizer";
import type { VisualFrame } from "@/types";

interface Input {
    parameters: number[][];
    gradients: number[][][];
    learningRate: number;
    decay: number;
    epsilon: number;
}

function mm(a: number[][], b: number[][]): number[][] {
    return [
        [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
        [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
    ];
}

function transpose(a: number[][]): number[][] {
    return [
        [a[0][0], a[1][0]],
        [a[0][1], a[1][1]],
    ];
}

function eig2x2(a: number, b: number, c: number): { q: number[][]; values: number[] } {
    const trace = a + c;
    const disc = Math.sqrt((a - c) * (a - c) + 4 * b * b);
    const l1 = (trace + disc) / 2;
    const l2 = (trace - disc) / 2;
    let v1x: number;
    let v1y: number;
    if (Math.abs(b) > 1e-12) {
        v1x = b;
        v1y = l1 - a;
        const norm = Math.sqrt(v1x * v1x + v1y * v1y);
        v1x /= norm;
        v1y /= norm;
    } else if (a >= c) {
        v1x = 1;
        v1y = 0;
    } else {
        v1x = 0;
        v1y = 1;
    }
    return { q: [[v1x, -v1y], [v1y, v1x]], values: [l1, l2] };
}

function power(a: number, b: number, c: number, p: number, epsilon: number): number[][] {
    const eig = eig2x2(a, b, c);
    const q = eig.q;
    const d0 = Math.pow(Math.max(0, eig.values[0]) + epsilon, p);
    const d1 = Math.pow(Math.max(0, eig.values[1]) + epsilon, p);
    return [
        [q[0][0] ** 2 * d0 + q[0][1] ** 2 * d1, q[0][0] * q[1][0] * d0 + q[0][1] * q[1][1] * d1],
        [q[0][0] * q[1][0] * d0 + q[0][1] * q[1][1] * d1, q[1][0] ** 2 * d0 + q[1][1] ** 2 * d1],
    ];
}

function reference(input: Input): number[][] {
    const theta = input.parameters.map((row) => row.slice());
    let left = [
        [0, 0],
        [0, 0],
    ];
    let right = [
        [0, 0],
        [0, 0],
    ];
    for (const g of input.gradients) {
        const gt = transpose(g);
        const ggT = mm(g, gt);
        const gTg = mm(gt, g);
        left = left.map((row, i) => row.map((value, j) => input.decay * value + (1 - input.decay) * ggT[i][j]));
        right = right.map((row, i) => row.map((value, j) => input.decay * value + (1 - input.decay) * gTg[i][j]));
        const fL = power(left[0][0], left[0][1], left[1][1], -0.25, input.epsilon);
        const fR = power(right[0][0], right[0][1], right[1][1], -0.25, input.epsilon);
        const update = mm(fL, mm(g, fR));
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                theta[i][j] -= input.learningRate * update[i][j];
            }
        }
    }
    return theta;
}

function checkFrames(frames: VisualFrame[], cells: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(cells);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Shampoo Optimizer", () => {
    const input: Input = {
        parameters: [
            [1, -0.5],
            [0.5, -1],
        ],
        gradients: [
            [
                [0.8, -0.3],
                [0.2, -0.6],
            ],
            [
                [0.4, -0.2],
                [0.1, -0.3],
            ],
            [
                [0.2, -0.1],
                [0.05, -0.15],
            ],
        ],
        learningRate: 0.05,
        decay: 0.9,
        epsilon: 1e-8,
    };

    it("matches an independent Shampoo replay", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, 4);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta["parameters"] as number[];
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                expect(final[i * 2 + j]).toBeCloseTo(expected[i][j], 9);
            }
        }
    });

    it("reduces a diagonal gradient update to the entry sign", () => {
        const diagonal: Input = {
            ...input,
            parameters: [
                [1, 2],
                [3, 4],
            ],
            gradients: [
                [
                    [0.8, 0],
                    [0, -0.3],
                ],
            ],
            decay: 0,
            epsilon: 1e-12,
        };
        const frames = [...mod.run(diagonal)];
        const final = frames[frames.length - 1]?.meta["parameters"] as number[];
        expect(final[0]).toBeCloseTo(1 - diagonal.learningRate, 3);
        expect(final[3]).toBeCloseTo(4 + diagonal.learningRate, 3);
        expect(final[1]).toBeCloseTo(2, 6);
        expect(final[2]).toBeCloseTo(3, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(input.gradients.length + 2);
        expect(generator.next().done).toBe(true);
    });
});

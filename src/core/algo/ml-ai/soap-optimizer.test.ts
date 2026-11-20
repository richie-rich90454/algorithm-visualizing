/** soap-optimizer.test.ts - Independent replay, Adam reduction, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./soap-optimizer";
import type { VisualFrame } from "@/types";

interface Input {
    parameters: number[][];
    gradients: number[][][];
    learningRate: number;
    decay: number;
    beta1: number;
    beta2: number;
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
    let m = [
        [0, 0],
        [0, 0],
    ];
    let v = [
        [0, 0],
        [0, 0],
    ];
    for (let t = 0; t < input.gradients.length; t += 1) {
        const g = input.gradients[t];
        const gt = transpose(g);
        const ggT = mm(g, gt);
        const gTg = mm(gt, g);
        left = left.map((row, i) => row.map((value, j) => input.decay * value + (1 - input.decay) * ggT[i][j]));
        right = right.map((row, i) => row.map((value, j) => input.decay * value + (1 - input.decay) * gTg[i][j]));
        const qL = eig2x2(left[0][0], left[0][1], left[1][1]).q;
        const qR = eig2x2(right[0][0], right[0][1], right[1][1]).q;
        const projected = mm(transpose(qL), mm(g, qR));
        m = m.map((row, i) => row.map((value, j) => input.beta1 * value + (1 - input.beta1) * projected[i][j]));
        v = v.map((row, i) =>
            row.map((value, j) => input.beta2 * value + (1 - input.beta2) * projected[i][j] * projected[i][j]),
        );
        const stepSize = t + 1;
        const upd = m.map((row, i) =>
            row.map(
                (value, j) =>
                    value / (1 - Math.pow(input.beta1, stepSize)) /
                    (Math.sqrt(v[i][j] / (1 - Math.pow(input.beta2, stepSize))) + input.epsilon),
            ),
        );
        const update = mm(qL, mm(upd, transpose(qR)));
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                theta[i][j] -= input.learningRate * update[i][j];
            }
        }
    }
    return theta;
}

/** Elementwise Adam on the four matrix entries, used for the diagonal reduction check. */
function elementwiseAdam(input: Input): number[][] {
    const theta = input.parameters.map((row) => row.slice());
    const m = theta.map((row) => row.map(() => 0));
    const v = theta.map((row) => row.map(() => 0));
    for (let t = 0; t < input.gradients.length; t += 1) {
        const g = input.gradients[t];
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                const value = g[i][j];
                m[i][j] = input.beta1 * m[i][j] + (1 - input.beta1) * value;
                v[i][j] = input.beta2 * v[i][j] + (1 - input.beta2) * value * value;
                const mHat = m[i][j] / (1 - Math.pow(input.beta1, t + 1));
                const vHat = v[i][j] / (1 - Math.pow(input.beta2, t + 1));
                theta[i][j] -= (input.learningRate * mHat) / (Math.sqrt(vHat) + input.epsilon);
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

describe("SOAP Optimizer", () => {
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
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8,
    };

    it("matches an independent SOAP replay", () => {
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

    it("reduces to elementwise Adam on diagonal gradients", () => {
        const diagonal: Input = {
            ...input,
            gradients: [
                [
                    [0.8, 0],
                    [0, -0.3],
                ],
                [
                    [0.4, 0],
                    [0, -0.15],
                ],
                [
                    [0.2, 0],
                    [0, -0.05],
                ],
            ],
        };
        const frames = [...mod.run(diagonal)];
        const final = frames[frames.length - 1]?.meta["parameters"] as number[];
        const expected = elementwiseAdam(diagonal);
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                expect(final[i * 2 + j]).toBeCloseTo(expected[i][j], 9);
            }
        }
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

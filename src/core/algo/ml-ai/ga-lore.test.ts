/** ga-lore.test.ts - Independent replay, rank-one property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./ga-lore";
import type { VisualFrame } from "@/types";

interface Input {
    parameters: number[][];
    gradients: number[][][];
    learningRate: number;
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

function eig2x2(a: number, b: number, c: number): number[][] {
    const trace = a + c;
    const disc = Math.sqrt((a - c) * (a - c) + 4 * b * b);
    const l1 = (trace + disc) / 2;
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
    return [[v1x, -v1y], [v1y, v1x]];
}

function reference(input: Input): number[][] {
    const theta = input.parameters.map((row) => row.slice());
    let m = [0, 0];
    let v = [0, 0];
    for (let t = 0; t < input.gradients.length; t += 1) {
        const g = input.gradients[t];
        const gt = [
            [g[0][0], g[1][0]],
            [g[0][1], g[1][1]],
        ];
        const ggT = mm(g, gt);
        const q = eig2x2(ggT[0][0], ggT[0][1], ggT[1][1]);
        const u = [q[0][0], q[1][0]];
        const gLow = [u[0] * g[0][0] + u[1] * g[1][0], u[0] * g[0][1] + u[1] * g[1][1]];
        m = m.map((value, j) => input.beta1 * value + (1 - input.beta1) * gLow[j]);
        v = v.map((value, j) => input.beta2 * value + (1 - input.beta2) * gLow[j] * gLow[j]);
        const updateLow = m.map(
            (value, j) =>
                value /
                (1 - Math.pow(input.beta1, t + 1)) /
                (Math.sqrt(v[j] / (1 - Math.pow(input.beta2, t + 1))) + input.epsilon),
        );
        const delta = [
            [u[0] * updateLow[0], u[0] * updateLow[1]],
            [u[1] * updateLow[0], u[1] * updateLow[1]],
        ];
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                theta[i][j] -= input.learningRate * delta[i][j];
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

describe("GaLore Optimizer", () => {
    const input: Input = {
        parameters: [
            [1, -0.5],
            [0.5, -1],
        ],
        gradients: [
            [
                [0.9, -0.4],
                [0.3, -0.6],
            ],
            [
                [0.5, -0.2],
                [0.2, -0.3],
            ],
            [
                [0.2, -0.1],
                [0.1, -0.15],
            ],
        ],
        learningRate: 0.05,
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8,
    };

    it("matches an independent GaLore replay", () => {
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

    it("produces a rank-one update at every step", () => {
        const frames = [...mod.run(input)];
        for (const frame of frames.slice(1, -1)) {
            const d = frame.meta["delta"] as number[];
            const determinant = d[0] * d[3] - d[1] * d[2];
            expect(Math.abs(determinant)).toBeLessThan(1e-12);
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

/** adafactor-optimizer.test.ts - Independent replay, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./adafactor-optimizer";
import type { VisualFrame } from "@/types";

interface Input {
    parameters: number[][];
    gradients: number[][][];
    learningRate: number;
    decay: number;
    epsilon: number;
    clipThreshold: number;
}

function reference(input: Input): number[][] {
    const theta = input.parameters.map((row) => row.slice());
    const rows = theta.length;
    const cols = theta[0].length;
    const rowFactor = new Array<number>(rows).fill(0);
    const colFactor = new Array<number>(cols).fill(0);
    for (const g of input.gradients) {
        for (let i = 0; i < rows; i += 1) {
            let sum = 0;
            for (let j = 0; j < cols; j += 1) {
                sum += g[i][j] * g[i][j];
            }
            rowFactor[i] = input.decay * rowFactor[i] + (1 - input.decay) * (sum / cols);
        }
        for (let j = 0; j < cols; j += 1) {
            let sum = 0;
            for (let i = 0; i < rows; i += 1) {
                sum += g[i][j] * g[i][j];
            }
            colFactor[j] = input.decay * colFactor[j] + (1 - input.decay) * (sum / rows);
        }
        const product = rowFactor.map((r) => colFactor.map((c) => r * c));
        const mean = product.flat().reduce((a, b) => a + b, 0) / (rows * cols);
        const update = product.map((line, i) =>
            line.map((v, j) => g[i][j] / (Math.sqrt(mean > 0 ? v / mean : 1) + input.epsilon)),
        );
        const rms = Math.sqrt(update.flat().reduce((a, b) => a + b * b, 0) / (rows * cols));
        const scale = rms > input.clipThreshold ? input.clipThreshold / rms : 1;
        for (let i = 0; i < rows; i += 1) {
            for (let j = 0; j < cols; j += 1) {
                theta[i][j] -= input.learningRate * scale * update[i][j];
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

describe("Adafactor Optimizer", () => {
    const input: Input = {
        parameters: [
            [1, -0.5],
            [0.5, -1],
        ],
        gradients: [
            [
                [0.8, -0.4],
                [0.3, -0.6],
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
        learningRate: 0.01,
        decay: 0.9,
        epsilon: 1e-3,
        clipThreshold: 1,
    };

    it("matches an independent Adafactor replay", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, 4);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta["parameters"] as number[];
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                expect(final[i * 2 + j]).toBeCloseTo(expected[i][j], 10);
            }
        }
    });

    it("never exceeds the clip threshold and leaves zero-gradient steps unchanged", () => {
        const frames = [...mod.run(input)];
        for (const frame of frames.slice(1, -1)) {
            expect(Number(frame.meta["scale"])).toBeLessThanOrEqual(1);
        }
        const zeroCase: Input = { ...input, gradients: [[[0, 0], [0, 0]]] };
        const zeroFrames = [...mod.run(zeroCase)];
        const final = zeroFrames[zeroFrames.length - 1]?.meta["parameters"] as number[];
        expect(final).toEqual(input.parameters.flat());
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

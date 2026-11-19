/** sm3.test.ts - Independent moment loop, memory claim, and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./sm3";
import type { VisualFrame } from "@/types";

interface Input {
    rows: number;
    cols: number;
    steps: number;
    learningRate: number;
    beta: number;
}

function reference(input: Input) {
    const target = Array.from({ length: input.rows }, (_u, i) =>
        Array.from({ length: input.cols }, (_v, j) => 0.8 * Math.cos((i + 1) * 0.6 + (j + 1) * 0.4)),
    );
    const theta = Array.from({ length: input.rows }, () => Array.from({ length: input.cols }, () => 0));
    const vRow = Array.from({ length: input.rows }, () => 0);
    const vCol = Array.from({ length: input.cols }, () => 0);
    for (let t = 0; t < input.steps; t += 1) {
        const rs = Array.from({ length: input.rows }, () => 0);
        const cs = Array.from({ length: input.cols }, () => 0);
        for (let i = 0; i < input.rows; i += 1)
            for (let j = 0; j < input.cols; j += 1) {
                const g = (theta[i]?.[j] ?? 0) - (target[i]?.[j] ?? 0);
                rs[i] = (rs[i] ?? 0) + g * g;
                cs[j] = (cs[j] ?? 0) + g * g;
            }
        for (let i = 0; i < input.rows; i += 1) {
            const avg = (rs[i] ?? 0) / input.cols;
            vRow[i] = Math.max(vRow[i] ?? 0, input.beta * (vRow[i] ?? 0) + (1 - input.beta) * avg);
        }
        for (let j = 0; j < input.cols; j += 1) {
            const avg = (cs[j] ?? 0) / input.rows;
            vCol[j] = Math.max(vCol[j] ?? 0, input.beta * (vCol[j] ?? 0) + (1 - input.beta) * avg);
        }
        for (let i = 0; i < input.rows; i += 1)
            for (let j = 0; j < input.cols; j += 1) {
                const g = (theta[i]?.[j] ?? 0) - (target[i]?.[j] ?? 0);
                const denom = Math.sqrt(Math.max(vRow[i] ?? 0, vCol[j] ?? 0)) + 1e-8;
                theta[i]![j] = (theta[i]?.[j] ?? 0) - (input.learningRate * g) / denom;
            }
    }
    return { theta, vRow, vCol };
}

function checkFrames(frames: VisualFrame[], input: Input): void {
    expect(frames.length).toBe(input.steps + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(input.rows * input.cols);
        expect(frame.entities.every((e) => e.id.length > 0 && Number.isFinite(e.value as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SM3 optimizer", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent factored-moment loop", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const rowsMeta = final?.["rowsMeta"] as number;
        const colsMeta = final?.["colsMeta"] as number;
        const last = frames[frames.length - 1];
        for (let i = 0; i < input.rows; i += 1) {
            for (let j = 0; j < input.cols; j += 1) {
                const entity = last?.entities.find((e) => e.metadata["row"] === i && e.metadata["col"] === j);
                expect(Number(entity?.value)).toBeCloseTo(expected.theta[i]?.[j] ?? 0, 8);
            }
        }
        const vRow = final?.["vRow"] as number[];
        vRow.forEach((value, i) => expect(value).toBeCloseTo(expected.vRow[i] ?? 0, 9));
        expect(rowsMeta).toBe(input.rows);
        expect(colsMeta).toBe(input.cols);
    });

    it("uses fewer moment values than a full second moment", () => {
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["memoryUsed"]).toBe(input.rows + input.cols);
        expect(final?.["fullMemory"]).toBe(input.rows * input.cols);
        expect(Number(final?.["memoryUsed"])).toBeLessThan(Number(final?.["fullMemory"]));
        expect(Number(final?.["objective"])).toBeLessThan(Number(frames[0]?.meta["objective"]));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(input.steps + 2);
        expect(generator.next().done).toBe(true);
    });
});

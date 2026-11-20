/** group-normalization.test.ts - Brute-force group statistics, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./group-normalization";
import type { VisualFrame } from "@/types";

interface Input {
    data: number[][];
    groups: number;
    gamma: number[];
    beta: number[];
    epsilon: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.meta).toBeDefined();
    });
}

function bruteForce(input: Input): { output: number[][]; stats: Array<Array<{ mean: number; variance: number }>> } {
    const channels = input.data[0]!.length;
    const output: number[][] = [];
    const stats: Array<Array<{ mean: number; variance: number }>> = [];
    input.data.forEach((row) => {
        const outRow = new Array<number>(channels).fill(0);
        const rowStats: Array<{ mean: number; variance: number }> = [];
        for (let g = 0; g < input.groups; g += 1) {
            const start = Math.floor((g * channels) / input.groups);
            const end = Math.floor(((g + 1) * channels) / input.groups);
            const groupValues = row.slice(start, end);
            const mu = groupValues.reduce((a, v) => a + v, 0) / groupValues.length;
            const variance =
                groupValues.reduce((a, v) => a + (v - mu) ** 2, 0) / groupValues.length;
            rowStats.push({ mean: mu, variance });
            for (let c = start; c < end; c += 1) {
                outRow[c] = input.gamma[c]! * ((row[c]! - mu) / Math.sqrt(variance + input.epsilon)) + input.beta[c]!;
            }
        }
        output.push(outRow);
        stats.push(rowStats);
    });
    return { output, stats };
}

describe("Group Normalization", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force group normalization", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = bruteForce(input);
        const final = frames[frames.length - 1]!.meta;
        (final["allOutput"] as number[]).forEach((v, i) =>
            expect(v).toBeCloseTo(expected.output.flat()[i]!, 8),
        );
        const stepFrames = frames.filter((f) => f.meta["groupMeans"] !== undefined);
        stepFrames.forEach((frame, n) => {
            (frame.meta["groupMeans"] as number[]).forEach((v, g) =>
                expect(v).toBeCloseTo(expected.stats[n]![g]!.mean, 10),
            );
            (frame.meta["groupVariances"] as number[]).forEach((v, g) =>
                expect(v).toBeCloseTo(expected.stats[n]![g]!.variance, 10),
            );
        });
    });

    it("does not mix statistics across samples or groups", () => {
        const frames = [...mod.run(input)];
        const stepFrames = frames.filter((f) => f.meta["groupMeans"] !== undefined);
        expect(stepFrames.length).toBe(input.data.length);
        const expected = bruteForce(input);
        stepFrames.forEach((frame, n) => {
            const means = frame.meta["groupMeans"] as number[];
            const variances = frame.meta["groupVariances"] as number[];
            means.forEach((mu, g) => {
                const size = Math.floor(((g + 1) * input.data[n]!.length) / input.groups) -
                    Math.floor((g * input.data[n]!.length) / input.groups);
                const values = input.data[n]!.slice(
                    Math.floor((g * input.data[n]!.length) / input.groups),
                    Math.floor(((g + 1) * input.data[n]!.length) / input.groups),
                );
                const directMean = values.reduce((a, v) => a + v, 0) / size;
                expect(mu).toBeCloseTo(directMean, 10);
                expect(variances[g]!).toBeCloseTo(expected.stats[n]![g]!.variance, 10);
            });
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

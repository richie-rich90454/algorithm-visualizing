/**
 * cuda-thread-hierarchy.test.ts - Exhaustive index mapping, brute-force warp
 * sums, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { warpReduce } from "./cuda-thread-hierarchy";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Number(frame.meta["rows"])).toBeGreaterThan(0);
        expect(Number(frame.meta["cols"])).toBeGreaterThan(0);
        for (const entity of frame.entities) expect(entity.type).toBe("cell");
    });
}

function seeded(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 69621) % 0x7fffffff;
        return s / 0x7fffffff;
    };
}

describe("CudaThreadHierarchy", () => {
    it("maps every thread index correctly and sums each warp by brute force", () => {
        const rand = seeded(53);
        for (let trial = 0; trial < 40; trial += 1) {
            const gridDim = 1 + Math.floor(rand() * 3);
            const blockDim = 2 + Math.floor(rand() * 4) * 2;
            const warpSize = 2 + Math.floor(rand() * 3) * 2;
            const total = gridDim * blockDim;
            const values = Array.from({ length: total }, () => Math.floor(rand() * 21) - 10);
            const frames = [...mod.run({ gridDim, blockDim, warpSize, values })];
            checkFrames(frames);
            const mapping = frames[0]?.entities ?? [];
            for (const cell of mapping) {
                const global = Number(cell.metadata["globalId"]);
                const block = Math.floor(global / blockDim);
                const thread = global % blockDim;
                expect(global).toBe(block * blockDim + thread);
                expect(cell.metadata["warpId"]).toBe(Math.floor(thread / warpSize));
                expect(cell.metadata["lane"]).toBe(thread % warpSize);
            }
            const final = frames[frames.length - 1]?.meta;
            const results = ((final?.["results"] as string[]) ?? []).map((s) => {
                const [block, warp, sum] = s.split(":");
                return { block: Number(block), warp: Number(warp), sum: Number(sum) };
            });
            expect(results.length).toBe(gridDim * Math.ceil(blockDim / warpSize));
            for (const result of results) {
                const first = result.warp * warpSize;
                const last = Math.min((result.warp + 1) * warpSize, blockDim);
                let sum = 0;
                for (let thread = first; thread < last; thread += 1) sum += values[result.block * blockDim + thread] ?? 0;
                expect(result.sum).toBe(sum);
            }
        }
    });

    it("warpReduce matches a direct sum for ragged and exact warps", () => {
        const rand = seeded(67);
        for (let trial = 0; trial < 80; trial += 1) {
            const n = 1 + Math.floor(rand() * 10);
            const values = Array.from({ length: n }, () => Math.floor(rand() * 31) - 15);
            expect(warpReduce(values).result).toBe(values.reduce((a, b) => a + b, 0));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

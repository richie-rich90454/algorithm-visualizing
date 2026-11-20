import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./succinct-bit-vector";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(f.layout).toBe(module.visualType);
        expect(f.meta).toBeDefined();
    });
}

describe("Succinct Bit Vector", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("matches naive rank and select on random bit vectors", () => {
        const cases = [
            [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0],
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
            [1],
        ];
        for (const bits of cases) {
            const frames = [...module.run({ bits })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            const naiveRanks: number[] = [];
            const naiveSelects: number[] = [];
            let count = 0;
            for (let i = 0; i < bits.length; i += 1) {
                naiveRanks.push(count);
                if (bits[i] === 1) {
                    naiveSelects.push(i);
                    count += 1;
                }
            }
            expect(last.meta.ranks).toEqual(naiveRanks);
            expect(last.meta.selects).toEqual(naiveSelects);
            expect(last.meta.totalOnes).toBe(bits.reduce((a, b) => a + b, 0));
        }
    });
});

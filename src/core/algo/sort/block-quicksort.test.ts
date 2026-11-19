import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./block-quicksort";

function collect(input: unknown): VisualFrame[] {
    return [...mod.run(input)];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.edges).toBeInstanceOf(Array);
        expect(frame.meta).toBeTypeOf("object");
        for (const entity of frame.entities) {
            expect(entity.type).toBe("bar");
            expect(entity.id).toMatch(/^bar-\d+$/);
        }
    });
}

function finalValues(frames: VisualFrame[]): number[] {
    const last = frames[frames.length - 1];
    expect(last).toBeDefined();
    return (last as VisualFrame).entities.map((entity) => Number(entity.label));
}

describe("Block Quicksort", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(1000);
    });

    it("matches a brute-force sort on the default input", () => {
        const values = (mod.defaultInput as { values: number[] }).values;
        const frames = collect({ values, blockSize: 2 });
        expect(finalValues(frames)).toEqual([...values].sort((a, b) => a - b));
    });

    it("matches a brute-force sort across random arrays and block sizes", () => {
        let seed = 20261119;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 120; trial += 1) {
            const n = 1 + (next() % 18);
            const values = Array.from({ length: n }, () => (next() % 41) - 20);
            const blockSize = 1 + (next() % 6);
            const frames = collect({ values, blockSize });
            checkFrames(frames);
            expect(finalValues(frames), `trial ${trial}, input ${JSON.stringify(values)}, B=${blockSize}`).toEqual(
                [...values].sort((a, b) => a - b),
            );
        }
    });

    it("handles an empty array without throwing", () => {
        const frames = collect([]);
        expect(frames.length).toBeGreaterThan(0);
        expect(frames[0]?.stepNumber).toBe(0);
        expect(finalValues(frames)).toEqual([]);
    });
});

import { describe, expect, it } from "vitest";
import mod from "./median-of-three-quicksort";

function checkFrame(frame: { stepNumber: number; entities: unknown[]; edges: unknown[]; description: string; codeLineNumber?: number; layout: string; meta: object }, lines: number): void {
    expect(Number.isInteger(frame.stepNumber)).toBe(true);
    expect(frame.entities.length).toBeGreaterThan(0);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber as number).toBeLessThan(lines);
    expect(frame.layout).toBe("array");
    expect(frame.meta).toBeTypeOf("object");
}

function finalValues(input: unknown): number[] {
    const frames = [...mod.run(input)];
    return frames[frames.length - 1]?.entities.map((e) => e.value as number) ?? [];
}

describe("Median-of-Three Quicksort", () => {
    const lines = mod.pseudocode?.length ?? 1;

    it("yields sequential, well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            checkFrame(f, lines);
        });
    });

    it("always picks the median of the three sampled values as pivot", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const pivotFrames = frames.filter((f) => Array.isArray(f.meta["candidates"]));
        expect(pivotFrames.length).toBeGreaterThan(0);
        for (const f of pivotFrames) {
            const c = [...(f.meta["candidates"] as Array<number | string>)].map(Number).sort((a, b) => a - b);
            expect(f.meta["pivotValue"]).toBe(c[1]);
        }
    });

    it("matches a reference sort across many inputs", () => {
        const cases: number[][] = [[], [1], [2, 1], [4, 4, 4, 4], [3, 2, 1], [1, 2, 3, 4, 5], [7, 2, 9, 4, 1, 6, 3, 8, 5]];
        for (let t = 0; t < 80; t += 1) {
            cases.push(Array.from({ length: t % 30 }, () => Math.floor(Math.random() * 40)));
        }
        for (const arr of cases) {
            expect(finalValues(arr)).toEqual([...arr].sort((a, b) => a - b));
        }
    });
});

import { describe, expect, it } from "vitest";
import mod from "./pdqsort";

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

describe("Pattern-Defeating Quicksort", () => {
    const lines = mod.pseudocode?.length ?? 1;

    it("yields sequential, well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            checkFrame(f, lines);
        });
    });

    it("matches a reference sort on adversarial patterns", () => {
        const cases: number[][] = [
            [],
            [1],
            [2, 1],
            [5, 5, 5, 5, 5],
            Array.from({ length: 40 }, (_, i) => i),
            Array.from({ length: 40 }, (_, i) => 40 - i),
            Array.from({ length: 60 }, () => Math.floor(Math.random() * 3)),
        ];
        for (let t = 0; t < 80; t += 1) {
            cases.push(Array.from({ length: t % 70 }, () => Math.floor(Math.random() * 1000)));
        }
        for (const arr of cases) {
            expect(finalValues(arr)).toEqual([...arr].sort((a, b) => a - b));
        }
    });

    it("detects sorted and reversed input without decomposing it", () => {
        const sorted = [...mod.run(Array.from({ length: 30 }, (_, i) => i))];
        const reversed = [...mod.run(Array.from({ length: 30 }, (_, i) => 30 - i))];
        expect(sorted.some((f) => f.meta["pattern"] === "ascending")).toBe(true);
        expect(reversed.some((f) => f.meta["pattern"] === "descending")).toBe(true);
    });
});

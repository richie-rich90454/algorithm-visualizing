import { describe, expect, it } from "vitest";
import mod from "./franken-sort";

function checkFrame(frame: ReturnType<ReturnType<typeof mod.run>["next"]>["value"], lines: number): void {
    expect(frame).toBeDefined();
    if (!frame) return;
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

describe("FrankenSort", () => {
    const lines = mod.pseudocode?.length ?? 1;

    it("yields sequential, well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            checkFrame(f, lines);
        });
    });

    it("sorts the default input", () => {
        expect(finalValues(mod.defaultInput)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("matches a reference sort across many inputs including duplicates", () => {
        const cases: number[][] = [[], [1], [2, 1], [5, 5, 5], [3, 2, 1], [9, 1, 8, 2, 7, 3, 6, 4, 5]];
        for (let t = 0; t < 60; t += 1) {
            cases.push(Array.from({ length: t % 25 }, () => Math.floor(Math.random() * 30) - 10));
        }
        for (const arr of cases) {
            expect(finalValues(arr)).toEqual([...arr].sort((a, b) => a - b));
        }
    });
});

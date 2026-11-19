import { describe, expect, it } from "vitest";
import mod, { symMergeRange } from "./symmerge";

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

describe("SymMerge Sort", () => {
    const lines = mod.pseudocode?.length ?? 1;

    it("yields sequential, well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            checkFrame(f, lines);
        });
    });

    it("sorts while preserving the multiset across many inputs", () => {
        for (let t = 0; t < 100; t += 1) {
            const arr = Array.from({ length: t % 40 }, () => Math.floor(Math.random() * 12));
            const got = finalValues(arr);
            expect(got).toEqual([...arr].sort((a, b) => a - b));
            expect([...got].sort((a, b) => a - b)).toEqual([...arr].sort((a, b) => a - b));
        }
    });

    it("the merge step is stable on tagged items", () => {
        for (let t = 0; t < 100; t += 1) {
            const n = 2 + (t % 20);
            const items = Array.from({ length: n }, (_, seq) => ({ key: Math.floor(Math.random() * 5), seq }));
            const half = Math.floor(n / 2);
            const left = items.slice(0, half).sort((a, b) => a.key - b.key || a.seq - b.seq);
            const right = items.slice(half).sort((a, b) => a.key - b.key || a.seq - b.seq);
            const a = [...left, ...right];
            symMergeRange(a, 0, half, n, (x, y) => x.key <= y.key);
            expect(a).toEqual([...items].sort((x, y) => x.key - y.key || x.seq - y.seq));
        }
    });
});

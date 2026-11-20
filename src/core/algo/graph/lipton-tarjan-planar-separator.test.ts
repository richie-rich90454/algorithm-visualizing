import { describe, expect, it } from "vitest";
import mod, { planarSeparator } from "./lipton-tarjan-planar-separator";

function checkFrame(frame: { stepNumber: number; entities: unknown[]; edges: unknown[]; description: string; codeLineNumber?: number; layout: string; meta: object }, lines: number): void {
    expect(Number.isInteger(frame.stepNumber)).toBe(true);
    expect(frame.entities.length).toBeGreaterThan(0);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber as number).toBeLessThan(lines);
    expect(frame.layout).toBe("graph");
    expect(frame.meta).toBeTypeOf("object");
}

describe("Lipton Tarjan Planar Separator", () => {
    const lines = mod.pseudocode?.length ?? 1;

    it("yields sequential, well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            checkFrame(f, lines);
        });
    });

    it("produces a balanced separator that actually disconnects the graph", () => {
        const graph = mod.defaultInput as Record<string, string[]>;
        const { depth, separator, level, components } = planarSeparator(graph);
        const n = Object.keys(graph).length;
        expect(separator.length).toBeGreaterThan(0);
        expect(separator.every((v) => depth.get(v) === level)).toBe(true);
        const removed = new Set(separator);
        const covered = new Set(separator);
        for (const comp of components) {
            expect(comp.length).toBeLessThanOrEqual(Math.ceil((2 * n) / 3));
            const shallow = comp.some((v) => (depth.get(v) as number) < level);
            const deep = comp.some((v) => (depth.get(v) as number) > level);
            expect(shallow && deep).toBe(false);
            for (const v of comp) {
                expect(removed.has(v)).toBe(false);
                covered.add(v);
            }
        }
        expect(covered.size).toBe(n);
    });

    it("balances a path and a star as well as the grid", () => {
        const path: Record<string, string[]> = { a: ["b"], b: ["a", "c"], c: ["b", "d"], d: ["c", "e"], e: ["d"] };
        const star: Record<string, string[]> = { c: ["a", "b", "d", "e"], a: ["c"], b: ["c"], d: ["c"], e: ["c"] };
        for (const graph of [path, star]) {
            const { components, separator, depth, level } = planarSeparator(graph);
            const n = Object.keys(graph).length;
            for (const comp of components) expect(comp.length).toBeLessThanOrEqual(Math.ceil((2 * n) / 3));
            expect(separator.every((v) => depth.get(v) === level)).toBe(true);
        }
    });
});

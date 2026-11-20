import { describe, expect, it } from "vitest";
import mod from "./erdos-renyi-generator";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Erdos-Renyi Generator", () => {
    it("produces exactly m distinct valid edges with consistent degrees", () => {
        const input = mod.defaultInput as { n: number; m: number; seed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const edges = meta["edges"] as string[];
        expect(edges.length).toBe(input.m);
        expect(new Set(edges).size).toBe(edges.length);
        const labels = new Set((meta["degree"] as number[]).map((_, i) => String.fromCharCode(65 + i)));
        const degree = new Map<string, number>();
        for (const edge of edges) {
            const [a, b] = edge.split("-");
            expect(a).not.toBe(b);
            expect(labels.has(a!)).toBe(true);
            expect(labels.has(b!)).toBe(true);
            degree.set(a!, (degree.get(a!) ?? 0) + 1);
            degree.set(b!, (degree.get(b!) ?? 0) + 1);
        }
        (meta["degree"] as number[]).forEach((value, i) => {
            expect(value).toBe(degree.get(String.fromCharCode(65 + i)) ?? 0);
        });
    });

    it("is deterministic for a fixed seed and clamps m", () => {
        const a = [...mod.run({ n: 8, m: 10, seed: 7 })].at(-1)!.meta["edges"];
        const b = [...mod.run({ n: 8, m: 10, seed: 7 })].at(-1)!.meta["edges"];
        expect(a).toEqual(b);
        const empty = [...mod.run({ n: 5, m: 0, seed: 2 })].at(-1)!.meta["edges"] as string[];
        expect(empty).toEqual([]);
        const full = [...mod.run({ n: 4, m: 100, seed: 2 })].at(-1)!.meta["edges"] as string[];
        expect(full.length).toBe(6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

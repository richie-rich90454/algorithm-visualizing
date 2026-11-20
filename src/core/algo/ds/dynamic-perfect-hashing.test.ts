import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./dynamic-perfect-hashing";

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

describe("Dynamic Perfect Hashing", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("stores every key exactly once and finds it on lookup", () => {
        const cases = [
            [5, 3, 8, 1, 9, 2, 7, 4, 6],
            [10, 20, 30, 40, 50],
            [1, 1, 1],
            [],
        ];
        for (const keys of cases) {
            const frames = [...module.run({ keys, buckets: 5 })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            const slots = last.meta.slots as number[][];
            const stored = slots.flat().filter((v) => v !== -1);
            expect([...stored].sort((a, b) => a - b)).toEqual([...keys].sort((a, b) => a - b));
            const lookups = last.meta.lookups as Array<[number, boolean]>;
            for (const [, ok] of lookups) expect(ok).toBe(true);
            expect(lookups.length).toBe(keys.length);
        }
    });
});

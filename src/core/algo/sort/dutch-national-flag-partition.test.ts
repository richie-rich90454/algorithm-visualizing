import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./dutch-national-flag-partition";

function collect(input: unknown): VisualFrame[] {
    return [...mod.run(input)];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.edges).toBeInstanceOf(Array);
        expect(frame.meta).toBeTypeOf("object");
        for (const entity of frame.entities) {
            expect(entity.type).toBe("bar");
            expect([0, 1, 2]).toContain(Number(entity.label));
        }
    });
}

function finalValues(frames: VisualFrame[]): number[] {
    const last = frames[frames.length - 1] as VisualFrame;
    return last.entities.map((entity) => Number(entity.label));
}

describe("Dutch National Flag Partition", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(500);
    });

    it("groups the default input by brute force", () => {
        const values = (mod.defaultInput as { values: number[] }).values;
        expect(finalValues(collect(values))).toEqual([...values].sort((a, b) => a - b));
    });

    it("matches a brute-force sort on random ternary arrays", () => {
        let seed = 987654321;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 200; trial += 1) {
            const n = next() % 25;
            const values = Array.from({ length: n }, () => next() % 3);
            if (n === 0) continue;
            const frames = collect(values);
            checkFrames(frames);
            expect(finalValues(frames)).toEqual([...values].sort((a, b) => a - b));
            for (const frame of frames) {
                expect(Number(frame.meta.low)).toBeGreaterThanOrEqual(0);
                expect(Number(frame.meta.high)).toBeLessThan(n);
            }
        }
    });

    it("is already correct on a sorted input", () => {
        const values = [0, 0, 1, 1, 1, 2, 2];
        expect(finalValues(collect(values))).toEqual(values);
    });
});

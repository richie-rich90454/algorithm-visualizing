import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./stable-quicksort";

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
            expect(entity.metadata.originalIndex).toBeTypeOf("number");
        }
    });
}

function finalEntities(frames: VisualFrame[]): VisualFrame["entities"] {
    const last = frames[frames.length - 1] as VisualFrame;
    return last.entities;
}

describe("Stable Quicksort", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(1000);
    });

    it("sorts the default input and preserves tie order", () => {
        const values = (mod.defaultInput as { values: number[] }).values;
        const last = finalEntities(collect(values));
        expect(last.map((e) => Number(e.label))).toEqual([...values].sort((a, b) => a - b));
        expect(isStable(last)).toBe(true);
    });

    it("matches a stable brute-force sort on random arrays", () => {
        let seed = 112233;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 150; trial += 1) {
            const n = 1 + (next() % 15);
            const values = Array.from({ length: n }, () => next() % 7);
            const last = finalEntities(collect(values));
            expect(last.map((e) => Number(e.label)), `trial ${trial}, input ${JSON.stringify(values)}`).toEqual(
                [...values].sort((a, b) => a - b),
            );
            expect(isStable(last)).toBe(true);
            const frames = collect(values);
            checkFrames(frames);
        }
    });

    it("keeps every key in place when the input is already sorted", () => {
        const values = [1, 1, 2, 2, 3, 3];
        const last = finalEntities(collect(values));
        expect(last.map((e) => Number(e.metadata.originalIndex))).toEqual([0, 1, 2, 3, 4, 5]);
    });
});

function isStable(entities: VisualFrame["entities"]): boolean {
    const seen = new Map<number, number>();
    for (const entity of entities) {
        const value = Number(entity.label);
        const id = Number(entity.metadata.originalIndex);
        if (seen.has(value) && (seen.get(value) as number) > id) return false;
        seen.set(value, id);
    }
    return true;
}

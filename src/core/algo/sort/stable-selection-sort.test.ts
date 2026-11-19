import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./stable-selection-sort";

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
        for (const entity of frame.entities) expect(entity.type).toBe("bar");
    });
}

function finalOrder(frame: VisualFrame): number[] {
    return frame.entities.map((entity) => Number(entity.metadata.original));
}

function finalValues(frame: VisualFrame): number[] {
    return frame.entities.map((entity) => Number(entity.value));
}

function reference(values: number[]): number[] {
    return values
        .map((value, original) => ({ value, original }))
        .sort((a, b) => a.value - b.value || a.original - b.original)
        .map((entry) => entry.original);
}

describe("Stable Selection Sort", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(500);
    });

    it("matches a stable reference sort across random inputs", () => {
        let seed = 998877;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 120; trial += 1) {
            const n = next() % 12;
            const values = Array.from({ length: n }, () => next() % 5);
            const frames = collect(values);
            checkFrames(frames);
            const last = frames[frames.length - 1] as VisualFrame;
            expect(finalOrder(last)).toEqual(reference(values));
            expect(finalValues(last)).toEqual([...values].sort((a, b) => a - b));
            const seen = new Set<number>();
            for (const frame of frames) {
                const order = frame.entities.map((entity) => Number(entity.metadata.original));
                expect(new Set(order).size).toBe(order.length);
                for (const original of order) seen.add(original);
            }
            expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
        }
    });

    it("handles empty and single-element arrays", () => {
        for (const values of [[], [7]]) {
            const frames = collect(values);
            checkFrames(frames);
            const last = frames[frames.length - 1] as VisualFrame;
            expect(finalValues(last)).toEqual([...values]);
        }
    });
});

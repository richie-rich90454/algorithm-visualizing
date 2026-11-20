import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./kirkpatrick-reisch-sort";

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
        for (const entity of frame.entities) expect(entity.type).toBe("bar");
    });
}

function finalValues(frames: VisualFrame[]): number[] {
    const last = frames[frames.length - 1] as VisualFrame;
    return last.entities.map((entity) => Number(entity.label));
}

describe("Kirkpatrick-Reisch Sort", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(100);
    });

    it("sorts the default input by brute force", () => {
        const values = (mod.defaultInput as { values: number[] }).values;
        expect(finalValues(collect(values))).toEqual([...values].sort((a, b) => a - b));
    });

    it("sorts random two-digit keys with duplicates", () => {
        let seed = 13579;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 200; trial += 1) {
            const n = 1 + (next() % 16);
            const values = Array.from({ length: n }, () => next() % 100);
            const frames = collect(values);
            checkFrames(frames);
            expect(finalValues(frames), `trial ${trial}, input ${JSON.stringify(values)}`).toEqual(
                [...values].sort((a, b) => a - b),
            );
        }
    });

    it("handles a single key", () => {
        expect(finalValues(collect([42]))).toEqual([42]);
    });
});

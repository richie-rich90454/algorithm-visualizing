import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./ko-aluru-small-large";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(frame.layout).toBe(module.visualType);
        expect(frame.meta).toBeDefined();
    });
}

/** Deterministic pseudo-random generator so failures are reproducible. */
function seeded(seed: number): () => number {
    let value = seed >>> 0;
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0;
        return value;
    };
}

describe("KoAluruSmallLarge", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("matches a reference ascending sort on many key sets", () => {
        const next = seeded(12345);
        for (let trial = 0; trial < 30; trial += 1) {
            const length = 1 + (next() % 18);
            const values = Array.from({ length }, () => Math.floor(next() % 200));
            const frames = [...module.run({ values })];
            checkFrames(frames);
            const expected = [...values].sort((a, b) => a - b).join(",");
            expect(frames[frames.length - 1]!.meta.sorted).toBe(expected);
        }
    });

    it("handles duplicates, zeros, and single keys", () => {
        const cases = [
            [5, 5, 5, 5],
            [0, 0, 1, 0],
            [42],
            [99, 1, 99, 1, 50],
        ];
        for (const values of cases) {
            const frames = [...module.run({ values })];
            checkFrames(frames);
            expect(frames[frames.length - 1]!.meta.sorted).toBe([...values].sort((a, b) => a - b).join(","));
        }
    });
});

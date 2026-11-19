import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./sorted-matrix-binary-search";

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
        expect(frame.layout).toBe("grid");
        expect(frame.edges).toBeInstanceOf(Array);
        expect(frame.meta).toBeTypeOf("object");
        for (const entity of frame.entities) expect(entity.type).toBe("cell");
    });
}

describe("Sorted Matrix Staircase Search", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        const last = frames[frames.length - 1] as VisualFrame;
        expect(last.meta.found).toBe(true);
        expect(last.meta.target).toBe(9);
    });

    it("matches brute-force membership on random sorted matrices", () => {
        let seed = 1357911;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 150; trial += 1) {
            const rows = 1 + (next() % 5);
            const cols = 1 + (next() % 5);
            const base = Array.from({ length: rows }, () => next() % 7).sort((a, b) => a - b);
            const step = Array.from({ length: cols }, () => next() % 4).sort((a, b) => a - b);
            const matrix = base.map((b) => step.map((s) => b * 3 + s));
            const target = next() % 25;
            const frames = collect({ matrix, target });
            checkFrames(frames);
            const last = frames[frames.length - 1] as VisualFrame;
            const present = matrix.some((row) => row.includes(target));
            expect(last.meta.found).toBe(present);
            if (present) {
                const r = Number(last.meta.foundRow);
                const c = Number(last.meta.foundCol);
                expect(matrix[r]?.[c]).toBe(target);
            }
            for (const frame of frames) {
                expect(frame.entities.length).toBe(rows * cols);
            }
        }
    });

    it("handles empty and ragged matrices", () => {
        for (const matrix of [[], [[]], [[1, 2], [3]]]) {
            const frames = collect({ matrix, target: 1 });
            checkFrames(frames);
            const last = frames[frames.length - 1] as VisualFrame;
            expect(last.meta.found).toBe(false);
        }
    });
});

/**
 * sam-2.test.ts - Mask propagation correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sam-2";
import type { VisualFrame } from "@/types";

type Label = -1 | 0 | 1;
type Seed = [number, number, number];

/** Independent simultaneous majority propagation reference. */
function reference(rows: number, cols: number, prompt: Seed[], iterations: number): Label[] {
    const mask: Label[][] = Array.from({ length: rows }, () => new Array<Label>(cols).fill(-1));
    for (const [r, c, label] of prompt) {
        mask[r]![c] = label as Label;
    }
    for (let it = 0; it < iterations; it += 1) {
        const snap = mask.map((row) => [...row]);
        for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
                if (snap[r]?.[c] !== -1) {
                    continue;
                }
                const around = [
                    snap[r - 1]?.[c],
                    snap[r + 1]?.[c],
                    snap[r]?.[c - 1],
                    snap[r]?.[c + 1],
                ];
                const ones = around.filter((v) => v === 1).length;
                const zeros = around.filter((v) => v === 0).length;
                if (ones > zeros) {
                    mask[r]![c] = 1;
                } else if (zeros > ones) {
                    mask[r]![c] = 0;
                }
            }
        }
    }
    return mask.flat();
}

function checkFrames(frames: VisualFrame[], cells: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SAM 2 mask propagation core", () => {
    it("matches an independent propagation reference and keeps seeds fixed", () => {
        const input = mod.defaultInput as { rows: number; cols: number; prompt: Seed[]; iterations: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.rows * input.cols);
        const final = frames[frames.length - 1]?.meta["maskFlat"] as number[];
        expect(final).toEqual(reference(input.rows, input.cols, input.prompt, input.iterations));
        for (const [r, c, label] of input.prompt) {
            expect(final[r * input.cols + c]).toBe(label);
        }
    });

    it("agrees with the reference on a different grid and prompt", () => {
        const input = { rows: 3, cols: 5, prompt: [[1, 1, 1], [1, 2, 1], [2, 4, 0]] as Seed[], iterations: 2 };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta["maskFlat"] as number[];
        expect(final).toEqual(reference(input.rows, input.cols, input.prompt, input.iterations));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

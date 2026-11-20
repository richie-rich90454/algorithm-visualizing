/** Correctness, frame shape, and termination checks for Zhang-Suen thinning. */
import { describe, expect, it } from "vitest";
import mod from "./zhang-suen-thinning";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((e) => expect(e.type).toBe("cell"));
    });
}

function skeleton(image: number[][]): number[][] {
    const frames = [...mod.run({ image })];
    checkFrames(frames);
    const encoded = frames[frames.length - 1]?.meta["grid"] as string[];
    return encoded.map((row) => [...row].map(Number));
}

describe("Zhang-Suen Thinning", () => {
    it("only removes foreground pixels and is idempotent", () => {
        const input = mod.defaultInput as { image: number[][] };
        const output = skeleton(input.image);
        expect(output.length).toBe(input.image.length);
        for (let r = 0; r < output.length; r += 1) {
            for (let c = 0; c < (output[r]?.length ?? 0); c += 1) {
                expect(output[r]![c]).toBeLessThanOrEqual(input.image[r]![c]!);
            }
        }
        expect(skeleton(output)).toEqual(output);
    });

    it("peels the interior of a filled block", () => {
        const block: number[][] = Array.from({ length: 7 }, (_, r) =>
            Array.from({ length: 7 }, (_, c) =>
                r > 0 && r < 6 && c > 0 && c < 6 ? 1 : 0,
            ),
        );
        const output = skeleton(block);
        const before = block.flat().reduce((a, b) => a + b, 0);
        const after = output.flat().reduce((a, b) => a + b, 0);
        expect(after).toBeLessThan(before);
        expect(output[3]![3]).toBe(1);
        const countOneNeighbors = (r: number, c: number): number => {
            let n = 0;
            for (let dr = -1; dr <= 1; dr += 1) {
                for (let dc = -1; dc <= 1; dc += 1) {
                    if (dr === 0 && dc === 0) continue;
                    n += output[r + dr]![c + dc] ?? 0;
                }
            }
            return n;
        };
        let interiorRemoved = 0;
        for (let r = 1; r < 6; r += 1) {
            for (let c = 1; c < 6; c += 1) {
                if (block[r]![c] === 1 && output[r]![c] === 0 && countOneNeighbors(r, c) > 0) {
                    interiorRemoved += 1;
                }
            }
        }
        expect(interiorRemoved).toBeGreaterThan(0);
    });

    it("handles thin lines and empty images", () => {
        const line = [
            [0, 0, 0, 0, 0],
            [0, 1, 1, 1, 0],
            [0, 0, 0, 0, 0],
        ];
        const output = skeleton(line);
        expect(output).toEqual(line);
        const empty = skeleton([
            [0, 0],
            [0, 0],
        ]);
        expect(empty.flat().reduce((a, b) => a + b, 0)).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

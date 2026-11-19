/** gorosort.test.ts - Relocation sorting correctness, frames, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./gorosort";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities).toHaveLength(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function values(frame: VisualFrame): number[] {
    return frame.entities.map((e) => Number(e.value));
}

/** Independent inversion count. */
function inversions(arr: number[]): number {
    let count = 0;
    for (let i = 0; i < arr.length; i += 1) {
        for (let j = i + 1; j < arr.length; j += 1) {
            if ((arr[i] as number) > (arr[j] as number)) {
                count += 1;
            }
        }
    }
    return count;
}

describe("GoroSort", () => {
    it("sorts small arrays and never increases disorder", () => {
        const cases = [
            [2, 1],
            [3, 1, 2],
            [5, 1, 4, 2, 3],
            [4, 3, 2, 1],
            [6, 2, 5, 1, 4, 3],
            [3, 3, 1, 2],
        ];
        for (const arr of cases) {
            const before = [...arr];
            const frames = [...mod.run({ values: arr, seed: 777, maxAttempts: 5000 })];
            checkFrames(frames, arr.length);
            expect(arr).toEqual(before);
            let previous = inversions(arr);
            for (const frame of frames) {
                const current = inversions(values(frame));
                expect(current).toBeLessThanOrEqual(previous);
                previous = current;
            }
            const last = frames[frames.length - 1] as VisualFrame;
            expect(last.meta["sorted"]).toBe(true);
            expect(values(last)).toEqual([...arr].sort((a, b) => a - b));
        }
    });

    it("handles empty and already sorted inputs", () => {
        for (const arr of [[], [1, 2, 3]]) {
            const frames = [...mod.run({ values: arr, seed: 1, maxAttempts: 50 })];
            checkFrames(frames, arr.length);
            expect(frames[frames.length - 1]?.meta["sorted"]).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
        const last = frames[frames.length - 1] as VisualFrame;
        expect(Number(last.meta["attempts"])).toBeGreaterThanOrEqual(Number(last.meta["accepted"]));
    });
});

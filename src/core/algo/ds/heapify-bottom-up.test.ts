/**
 * heapify-bottom-up.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./heapify-bottom-up";
import type { VisualFrame } from "@/types";

function isMaxHeap(values: number[]): boolean {
    for (let i = 0; i < values.length; i += 1) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        if (left < values.length && (values[left] as number) > (values[i] as number)) {
            return false;
        }
        if (right < values.length && (values[right] as number) > (values[i] as number)) {
            return false;
        }
    }
    return true;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Bottom-Up Heap Construction", () => {
    it("produces a valid max-heap on the default input", () => {
        const input = mod.defaultInput as { values: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const heap = frames[frames.length - 1]?.meta["heap"] as number[];
        expect(isMaxHeap(heap)).toBe(true);
        expect([...heap].sort((a, b) => a - b)).toEqual([...input.values].sort((a, b) => a - b));
    });

    it("produces a valid max-heap on randomized inputs", () => {
        let seed = 3;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 60; t += 1) {
            const values = Array.from({ length: rand() % 25 }, () => rand() % 100 - 50);
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const heap = frames[frames.length - 1]?.meta["heap"] as number[];
            expect(isMaxHeap(heap)).toBe(true);
            expect([...heap].sort((a, b) => a - b)).toEqual([...values].sort((a, b) => a - b));
        }
    });

    it("handles empty and single-element arrays", () => {
        for (const values of [[], [7]]) {
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const heap = frames[frames.length - 1]?.meta["heap"] as number[];
            expect(heap).toEqual(values);
        }
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

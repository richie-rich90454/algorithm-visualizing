/**
 * bootstrapped-heap.test.ts - Sorted extraction correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./bootstrapped-heap";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
    }
}

describe("Bootstrapped Heap", () => {
    it("extracts the default input in sorted order with correct running minima", () => {
        const input = mod.defaultInput as { values: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["sorted"]).toEqual([...input.values].sort((a, b) => a - b));
        for (const frame of frames) {
            const removed = frame.meta["removed"];
            if (typeof removed !== "number") {
                continue;
            }
            const remaining = (frame.meta["extracted"] as number[]).slice();
            const remainingMin = frame.meta["remainingMin"] as number;
            const all = [...input.values].sort((a, b) => a - b);
            const used = new Map<number, number>();
            for (const x of remaining) {
                used.set(x, (used.get(x) ?? 0) + 1);
            }
            const leftover: number[] = [];
            for (const x of all) {
                const count = used.get(x) ?? 0;
                if (count > 0) {
                    used.set(x, count - 1);
                } else {
                    leftover.push(x);
                }
            }
            const expectedMin = leftover.length > 0 ? leftover[0] : -1;
            expect(remainingMin).toBe(expectedMin);
        }
    });

    it("sorts random multisets with duplicates and negatives", () => {
        let seed = 43;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const values: number[] = [];
            const n = 1 + Math.floor(rand() * 10);
            for (let i = 0; i < n; i += 1) {
                values.push(Math.floor(rand() * 20) - 10);
            }
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const sorted = frames[frames.length - 1]?.meta["sorted"] as number[];
            expect(sorted).toEqual([...values].sort((a, b) => a - b));
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

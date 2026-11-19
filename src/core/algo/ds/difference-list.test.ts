/**
 * difference-list.test.ts - Append-order correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./difference-list";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    }
}

describe("Difference List", () => {
    it("preserves the append order on the default input", () => {
        const input = mod.defaultInput as { values: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["list"]).toEqual(input.values);
        expect(final?.["applied"]).toBe(true);
    });

    it("matches ordinary concatenation on random sequences including duplicates", () => {
        let seed = 19;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const values: number[] = [];
            const n = Math.floor(rand() * 9);
            for (let i = 0; i < n; i += 1) {
                values.push(Math.floor(rand() * 20) - 10);
            }
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const result = frames[frames.length - 1]?.meta["list"] as number[];
            const expected: number[] = [];
            for (const value of values) {
                expected.push(value);
            }
            expect(result).toEqual(expected);
            expect(result.length).toBe(values.length);
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

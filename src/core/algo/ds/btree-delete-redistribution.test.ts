/**
 * btree-delete-redistribution.test.ts - Correctness, frame, and termination tests.
 */

import { describe, expect, it } from "vitest";
import mod from "./btree-delete-redistribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function expectedKeys(values: number[], deletions: number[]): number[] {
    const removed = new Set(deletions);
    return [...new Set(values)].filter((v) => !removed.has(v)).sort((a, b) => a - b);
}

describe("B-Tree Delete with Redistribution", () => {
    it("matches the default input oracle and stays structurally valid", () => {
        const input = mod.defaultInput as { values: number[]; deletions: number[]; order: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["keys"]).toEqual(expectedKeys(input.values, input.deletions));
        for (const frame of frames) {
            expect(frame.meta["valid"]).toBe(true);
        }
    });

    it("matches brute-force sets on random inputs", () => {
        let seed = 77003;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const count = 1 + (rand() % 26);
            const values: number[] = [];
            for (let k = 0; k < count; k += 1) {
                values.push(rand() % 70);
            }
            const deletions: number[] = [];
            const deleteCount = rand() % (count + 4);
            for (let k = 0; k < deleteCount; k += 1) {
                deletions.push(rand() % 70);
            }
            const frames = [...mod.run({ values, deletions, order: 2 })];
            checkFrames(frames);
            for (const frame of frames) {
                expect(frame.meta["valid"]).toBe(true);
            }
            const final = frames[frames.length - 1]?.meta["keys"] as number[];
            expect(final).toEqual(expectedKeys(values, deletions));
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

/** tweedledum-tweedledee.test.ts - Xor theorem cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./tweedledum-tweedledee";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function heapNimbers(max: number, limit: number): number[] {
    const values = [0];
    for (let size = 1; size <= max; size += 1) {
        const seen = new Set<number>();
        for (let remove = 1; remove <= limit; remove += 1) {
            if (size - remove >= 0) seen.add(values[size - remove] ?? 0);
        }
        let value = 0;
        while (seen.has(value)) value += 1;
        values.push(value);
    }
    return values;
}

function sumNimber(a: number, b: number, limit: number, memo = new Map<string, number>()): number {
    const key = `${a},${b}`;
    if (memo.has(key)) return memo.get(key)!;
    const seen = new Set<number>();
    for (let remove = 1; remove <= limit; remove += 1) {
        if (a - remove >= 0) seen.add(sumNimber(a - remove, b, limit, memo));
        if (b - remove >= 0) seen.add(sumNimber(a, b - remove, limit, memo));
    }
    let value = 0;
    while (seen.has(value)) value += 1;
    memo.set(key, value);
    return value;
}

describe("Tweedledum-Tweedledee Strategy", () => {
    it("confirms equal heaps have nimber zero and sums follow xor", () => {
        const single = heapNimbers(8, 3);
        for (let size = 0; size <= 8; size += 1) {
            expect(sumNimber(size, size, 3)).toBe(0);
            for (let other = 0; other <= 8; other += 1) {
                expect(sumNimber(size, other, 3)).toBe((single[size] ?? 0) ^ (single[other] ?? 0));
            }
        }
    });

    it("replays a mirror strategy that keeps the heaps equal", () => {
        const frames = [...mod.run({ heap: 9, maxRemove: 3, firstMove: 2 })];
        checkFrames(frames);
        expect(Number(frames[0]?.meta["sumGrundy"])).toBe(0);
        for (let index = 2; index < frames.length - 1; index += 2) {
            const left = Number(frames[index]?.meta["left"]);
            const right = Number(frames[index]?.meta["right"]);
            expect(left).toBe(right);
            expect(Number(frames[index]?.meta["sumGrundy"])).toBe(0);
        }
        const final = frames[frames.length - 1];
        expect(Number(final?.meta["left"])).toBe(0);
        expect(Number(final?.meta["right"])).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});

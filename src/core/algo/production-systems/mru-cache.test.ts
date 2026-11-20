/**
 * mru-cache.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./mru-cache";
import type { VisualFrame } from "@/types";

/** Independent MRU simulation. */
function reference(capacity: number, accesses: number[]) {
    const order: number[] = [];
    let faults = 0;
    for (const page of accesses) {
        const at = order.indexOf(page);
        if (at >= 0) {
            order.splice(at, 1);
            order.push(page);
        } else {
            faults += 1;
            if (order.length >= capacity) {
                order.pop();
            }
            order.push(page);
        }
    }
    return { faults, order };
}

function checkFrames(frames: VisualFrame[], accesses: number, capacity: number): void {
    expect(frames.length).toBe(accesses + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(accesses + capacity);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("MRU Cache", () => {
    it("matches an independent MRU simulation", () => {
        const input = mod.defaultInput as { capacity: number; accesses: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.accesses.length, input.capacity);
        const expected = reference(input.capacity, input.accesses);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["faults"])).toBe(expected.faults);
        expect(final?.["cache"]).toEqual(expected.order);
    });

    it("evicts the newest page on each fault in a cyclic scan", () => {
        const accesses = [1, 2, 3, 4, 1, 2, 3, 4];
        const frames = [...mod.run({ capacity: 3, accesses })];
        expect(Number(frames[frames.length - 1]?.meta["faults"])).toBe(5);
    });

    it("only faults on first use when all pages fit", () => {
        const frames = [...mod.run({ capacity: 5, accesses: [1, 2, 3, 2, 1] })];
        expect(Number(frames[frames.length - 1]?.meta["faults"])).toBe(3);
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

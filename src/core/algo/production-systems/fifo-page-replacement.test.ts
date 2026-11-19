/**
 * fifo-page-replacement.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./fifo-page-replacement";
import type { VisualFrame } from "@/types";

/** Independent FIFO simulation. */
function reference(capacity: number, accesses: number[]): { faults: number; frames: number[] } {
    const queue: number[] = [];
    let faults = 0;
    for (const page of accesses) {
        if (queue.includes(page)) {
            continue;
        }
        faults += 1;
        if (queue.length >= capacity) {
            queue.shift();
        }
        queue.push(page);
    }
    return { faults, frames: queue };
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
        expect(frame.meta["rows"]).toBe(2);
    });
}

describe("FIFO Page Replacement", () => {
    it("matches an independent FIFO simulation on the default input", () => {
        const input = mod.defaultInput as { capacity: number; accesses: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.accesses.length, input.capacity);
        const expected = reference(input.capacity, input.accesses);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["faults"])).toBe(expected.faults);
        expect(Number(final?.["hits"])).toBe(input.accesses.length - expected.faults);
        expect(final?.["frames"]).toEqual(expected.frames);
    });

    it("reproduces Belady's anomaly: more frames, more faults", () => {
        const accesses = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
        const three = [...mod.run({ capacity: 3, accesses })];
        const four = [...mod.run({ capacity: 4, accesses })];
        expect(Number(three[three.length - 1]?.meta["faults"])).toBe(9);
        expect(Number(four[four.length - 1]?.meta["faults"])).toBe(10);
    });

    it("keeps the resident set within capacity at every step", () => {
        const input = mod.defaultInput as { capacity: number; accesses: number[] };
        const frames = [...mod.run(input)];
        for (const frame of frames) {
            const resident = frame.meta["frames"] as number[];
            expect(resident.length).toBeLessThanOrEqual(input.capacity);
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

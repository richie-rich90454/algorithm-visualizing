/** Correctness, frame shape, and termination checks for Floyd cycle detection. */
import { describe, expect, it } from "vitest";
import mod from "./tortoise-and-hare-cycle-detection";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
    });
}

/** Independent cycle detection using a first-visit index table. */
function brute(next: number[], start: number): { entry: number; length: number } {
    const seen = new Map<number, number>();
    let v = start;
    let step = 0;
    while (!seen.has(v)) {
        seen.set(v, step);
        step += 1;
        v = next[v] as number;
    }
    const entry = v;
    const length = step - (seen.get(v) as number);
    return { entry, length };
}

describe("Tortoise and Hare Cycle Detection", () => {
    const cases: Array<{ next: number[]; start: number }> = [
        { next: [1, 2, 3, 4, 5, 2], start: 0 },
        { next: [0], start: 0 },
        { next: [1, 0], start: 0 },
        { next: [2, 2, 2], start: 0 },
        { next: [1, 2, 3, 4, 5, 6, 4], start: 0 },
        { next: [3, 3, 1, 2], start: 0 },
        { next: [1, 2, 3, 4, 4, 5], start: 2 },
    ];

    for (const input of cases) {
        it(`finds the cycle for ${JSON.stringify(input)}`, () => {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = brute(input.next, input.start);
            expect(final?.["entry"]).toBe(expected.entry);
            expect(final?.["cycleLength"]).toBe(expected.length);
        });
    }

    it("sanitizes out-of-range pointers into self-loops", () => {
        const frames = [...mod.run({ next: [5, -1, 1], start: 1 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["entry"]).toBe(1);
        expect(final?.["cycleLength"]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

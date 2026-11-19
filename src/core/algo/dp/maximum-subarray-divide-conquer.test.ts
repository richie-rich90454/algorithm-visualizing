/** maximum-subarray-divide-conquer.test.ts - Brute-force span check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import maximumSubarrayDivideConquer from "./maximum-subarray-divide-conquer";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? -1).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 999).toBeLessThan(
            maximumSubarrayDivideConquer.pseudocode?.length ?? 0,
        );
        expect(frame.layout).toBe("array");
        expect(frame.meta).toBeTypeOf("object");
        frame.entities.forEach((entity) => expect(entity.type).toBe("bar"));
    });
}

function sumAll(generator: Generator<VisualFrame, void, unknown>): VisualFrame[] {
    const frames: VisualFrame[] = [];
    for (const frame of generator) {
        frames.push(frame);
        expect(frames.length).toBeLessThan(100000);
    }
    return frames;
}

function bruteSpan(arr: number[]): { sum: number; lo: number; hi: number } {
    if (arr.length === 0) {
        return { sum: 0, lo: -1, hi: -1 };
    }
    let best = { sum: -Infinity, lo: 0, hi: 0 };
    for (let i = 0; i < arr.length; i += 1) {
        let running = 0;
        for (let j = i; j < arr.length; j += 1) {
            running += arr[j] as number;
            if (
                running > best.sum ||
                (running === best.sum && (i < best.lo || (i === best.lo && j < best.hi)))
            ) {
                best = { sum: running, lo: i, hi: j };
            }
        }
    }
    return best;
}

describe("Maximum Subarray (Divide and Conquer)", () => {
    it("matches a brute-force maximum subarray", () => {
        const cases = [
            [4, -1, 2, -7, 3, 9, -2, 5],
            [-5, -2, -9],
            [2, 1, 1, 2],
            [1, -3, 5, -2, 9, -8, -6, 4],
            [7],
            [],
            [0, 0, 0, 0],
        ];
        for (const input of cases) {
            const frames = sumAll(maximumSubarrayDivideConquer.run([...input]));
            const final = frames[frames.length - 1];
            const expected = bruteSpan(input);
            expect(final?.meta["bestSum"]).toBe(expected.sum);
            expect(final?.meta["bestLo"]).toBe(expected.lo);
            expect(final?.meta["bestHi"]).toBe(expected.hi);
        }
    });

    it("emits well-formed frames and terminates on the default input", () => {
        checkFrames(sumAll(maximumSubarrayDivideConquer.run(maximumSubarrayDivideConquer.defaultInput)));
        const generator = maximumSubarrayDivideConquer.run(maximumSubarrayDivideConquer.defaultInput);
        let count = 0;
        while (generator.next().done !== true) {
            count += 1;
            expect(count).toBeLessThan(100000);
        }
    });
});

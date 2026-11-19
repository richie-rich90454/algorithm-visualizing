/**
 * optimal-page-replacement.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./optimal-page-replacement";
import type { VisualFrame } from "@/types";

/** Brute-force the minimum number of faults over every eviction choice. */
function bruteForce(capacity: number, accesses: number[]): number {
    const memo = new Map<string, number>();
    const solve = (index: number, resident: number[]): number => {
        if (index >= accesses.length) {
            return 0;
        }
        const key = `${index}:${[...resident].sort((a, b) => a - b).join(",")}`;
        const cached = memo.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const page = accesses[index] ?? 0;
        let best: number;
        if (resident.includes(page)) {
            best = solve(index + 1, resident);
        } else if (resident.length < capacity) {
            best = 1 + solve(index + 1, [...resident, page]);
        } else {
            best = Number.POSITIVE_INFINITY;
            for (let evict = 0; evict < resident.length; evict += 1) {
                const next = [...resident];
                next.splice(evict, 1);
                next.push(page);
                best = Math.min(best, 1 + solve(index + 1, next));
            }
        }
        memo.set(key, best);
        return best;
    };
    return solve(0, []);
}

/** Straight FIFO, used only to assert MIN is never worse. */
function fifoFaults(capacity: number, accesses: number[]): number {
    const queue: number[] = [];
    let faults = 0;
    for (const page of accesses) {
        if (!queue.includes(page)) {
            faults += 1;
            if (queue.length >= capacity) {
                queue.shift();
            }
            queue.push(page);
        }
    }
    return faults;
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

describe("Optimal Page Replacement", () => {
    it("matches an exhaustive search for the minimum fault count", () => {
        const input = mod.defaultInput as { capacity: number; accesses: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.accesses.length, input.capacity);
        const expected = bruteForce(input.capacity, input.accesses);
        const actual = Number(frames[frames.length - 1]?.meta["faults"]);
        expect(actual).toBe(expected);
        expect(actual).toBeLessThanOrEqual(fifoFaults(input.capacity, input.accesses));
    });

    it("is optimal across several reference strings and capacities", () => {
        const cases: Array<{ capacity: number; accesses: number[] }> = [
            { capacity: 2, accesses: [1, 2, 1, 3, 1, 2, 4, 1] },
            { capacity: 3, accesses: [4, 3, 2, 1, 4, 3, 5, 4, 3, 2, 1, 5] },
            { capacity: 4, accesses: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            const actual = Number(frames[frames.length - 1]?.meta["faults"]);
            expect(actual).toBe(bruteForce(testCase.capacity, testCase.accesses));
        }
    });

    it("only faults on first use when all pages fit", () => {
        const frames = [...mod.run({ capacity: 6, accesses: [1, 2, 3, 1, 2, 3] })];
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

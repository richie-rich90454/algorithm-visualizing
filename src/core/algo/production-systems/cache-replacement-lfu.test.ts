/**
 * cache-replacement-lfu.test.ts - Independent LFU reference, bounds, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cache-replacement-lfu";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], accesses: number[], capacity: number): void {
    expect(frames.length).toBe(accesses.length + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(accesses.length + capacity);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(Math.max(accesses.length, capacity));
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const keys = frame.meta["keys"] as number[];
        expect(keys.length).toBeLessThanOrEqual(capacity);
    });
}

interface Resident {
    key: number;
    frequency: number;
    recency: number;
}

/** Independent LFU reference using objects sorted by frequency then recency. */
function reference(capacity: number, accesses: number[]): { keys: number[]; decisions: boolean[]; evicted: number[] } {
    let resident: Resident[] = [];
    let clock = 0;
    const decisions: boolean[] = [];
    const evicted: number[] = [];
    for (const key of accesses) {
        clock += 1;
        const found = resident.find((r) => r.key === key);
        if (found) {
            found.frequency += 1;
            found.recency = clock;
            decisions.push(true);
        } else {
            decisions.push(false);
            if (resident.length >= capacity) {
                const sorted = [...resident].sort((a, b) => a.frequency - b.frequency || a.recency - b.recency);
                const victim = sorted[0]!;
                evicted.push(victim.key);
                resident = resident.filter((r) => r !== victim);
            }
            resident.push({ key, frequency: 1, recency: clock });
        }
    }
    return { keys: resident.map((r) => r.key), decisions, evicted };
}

describe("LFU cache replacement", () => {
    it("matches an independent LFU implementation for several traces", () => {
        const cases: Array<{ capacity: number; accesses: number[] }> = [
            { capacity: 3, accesses: [1, 2, 3, 1, 2, 4, 1, 5, 2, 3, 4, 5] },
            { capacity: 2, accesses: [1, 2, 1, 3, 2, 3, 1, 2] },
            { capacity: 4, accesses: [5, 4, 3, 2, 1, 5, 4, 6, 7, 1, 2] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.accesses, testCase.capacity);
            const meta = frames[frames.length - 1]?.meta;
            const want = reference(testCase.capacity, testCase.accesses);
            expect(meta?.["decisions"]).toEqual(want.decisions.map((d) => (d ? 1 : 0)));
            expect(meta?.["evicted"]).toEqual(want.evicted);
            expect(meta?.["keys"]).toEqual(want.keys);
            expect(Number(meta?.["hits"]) + Number(meta?.["misses"])).toBe(testCase.accesses.length);
        }
    });

    it("keeps frequencies positive and consistent with hits", () => {
        const accesses = [1, 1, 1, 2, 3, 2, 2, 4, 1, 5];
        const frames = [...mod.run({ capacity: 3, accesses })];
        checkFrames(frames, accesses, 3);
        for (const frame of frames) {
            const frequencies = frame.meta["frequencies"] as number[];
            for (const frequency of frequencies) {
                expect(frequency).toBeGreaterThan(0);
            }
        }
        const meta = frames[frames.length - 1]?.meta;
        const keys = meta?.["keys"] as number[];
        const frequencies = meta?.["frequencies"] as number[];
        expect(keys.length).toBe(frequencies.length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(13);
        expect(generator.next().done).toBe(true);
    });
});

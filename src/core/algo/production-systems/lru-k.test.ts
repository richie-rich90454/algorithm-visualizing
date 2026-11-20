/**
 * lru-k.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lru-k";
import type { VisualFrame } from "@/types";

/** Independent LRU-K simulation. */
function reference(capacity: number, k: number, accesses: number[]) {
    const resident: number[] = [];
    const history = new Map<number, number[]>();
    let faults = 0;
    for (let t = 0; t < accesses.length; t += 1) {
        const page = accesses[t] ?? 0;
        if (resident.includes(page)) {
            const times = history.get(page) ?? [];
            times.push(t);
            history.set(page, times.slice(-k));
            continue;
        }
        faults += 1;
        if (resident.length >= capacity) {
            let victim = resident[0] ?? 0;
            let worst = Number.POSITIVE_INFINITY;
            let worstRecent = Number.POSITIVE_INFINITY;
            for (const candidate of resident) {
                const times = history.get(candidate) ?? [];
                const kt = times.length < k ? Number.NEGATIVE_INFINITY : (times[times.length - k] ?? 0);
                const recent = times.length > 0 ? (times[times.length - 1] ?? 0) : -1;
                if (kt < worst || (kt === worst && recent < worstRecent)) {
                    worst = kt;
                    worstRecent = recent;
                    victim = candidate;
                }
            }
            resident.splice(resident.indexOf(victim), 1);
            history.delete(victim);
        }
        resident.push(page);
        const times = history.get(page) ?? [];
        times.push(t);
        history.set(page, times.slice(-k));
    }
    return { faults, resident };
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

describe("LRU-K", () => {
    it("matches an independent LRU-K simulation", () => {
        const input = mod.defaultInput as { capacity: number; k: number; accesses: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.accesses.length, input.capacity);
        const expected = reference(input.capacity, input.k, input.accesses);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["faults"])).toBe(expected.faults);
        expect(final?.["frames"]).toEqual(expected.resident);
    });

    it("degenerates to ordinary LRU when k is one", () => {
        const accesses = [1, 2, 3, 1, 4, 2, 5, 1, 3];
        const viaModule = [...mod.run({ capacity: 3, k: 1, accesses })];
        const viaK1 = reference(3, 1, accesses);
        const viaK2 = reference(3, 2, accesses);
        expect(Number(viaModule[viaModule.length - 1]?.meta["faults"])).toBe(viaK1.faults);
        expect(viaK1.faults).toBeGreaterThan(0);
        expect(viaK2.faults).toBeGreaterThan(0);
    });

    it("only faults on first use when the cache exceeds the working set", () => {
        const frames = [...mod.run({ capacity: 10, k: 3, accesses: [1, 2, 3, 4, 2, 1] })];
        expect(Number(frames[frames.length - 1]?.meta["faults"])).toBe(4);
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

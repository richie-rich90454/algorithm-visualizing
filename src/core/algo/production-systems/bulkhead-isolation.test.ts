/**
 * bulkhead-isolation.test.ts - Reference admission simulation, isolation
 * properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bulkhead-isolation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], p: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(p);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function reference(capacities: number[], requests: number[]) {
    const used = new Array<number>(capacities.length).fill(0);
    const admitted = new Array<number>(capacities.length).fill(0);
    const rejected = new Array<number>(capacities.length).fill(0);
    for (const pool of requests) {
        if (pool < 0 || pool >= capacities.length) {
            continue;
        }
        if (used[pool]! < capacities[pool]!) {
            used[pool]! += 1;
            admitted[pool]! += 1;
        } else {
            rejected[pool]! += 1;
        }
    }
    return { used, admitted, rejected };
}

describe("BulkheadIsolation", () => {
    it("matches an independent admission simulation", () => {
        const input = mod.defaultInput as { capacities: number[]; requests: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.capacities.length);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input.capacities, input.requests);
        expect(meta["used"]).toEqual(expected.used);
        expect(meta["admitted"]).toEqual(expected.admitted);
        expect(meta["rejected"]).toEqual(expected.rejected);
    });

    it("keeps a saturated pool isolated from the others", () => {
        const frames = [...mod.run({ capacities: [1, 3], requests: [0, 0, 0, 1, 1] })];
        const afterFirstSaturates = frames[2]!.meta["used"] as number[];
        expect(afterFirstSaturates).toEqual([1, 0]);
        const final = frames[frames.length - 1]!.meta;
        expect(final["used"]).toEqual([1, 2]);
        expect(final["rejected"]).toEqual([2, 0]);
    });

    it("never exceeds capacity in any pool", () => {
        for (const frame of [...mod.run(mod.defaultInput)]) {
            const used = frame.meta["used"] as number[];
            const capacities = frame.meta["capacities"] as number[];
            for (let i = 0; i < used.length; i += 1) {
                expect(used[i]!).toBeLessThanOrEqual(capacities[i]!);
            }
        }
    });

    it("handles empty pools and terminates cleanly", () => {
        const empty = [...mod.run({ capacities: [] })];
        expect(empty).toHaveLength(1);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe((mod.defaultInput as { requests: number[] }).requests.length + 2);
        expect(generator.next().done).toBe(true);
    });
});

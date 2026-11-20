/**
 * rolling-update.test.ts - Reference rollout simulation, availability and
 * rollback properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./rolling-update";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect((frame.meta["states"] as string[]).length).toBe(n);
    });
}

function reference(total: number, batchSize: number, maxUnavailable: number, healthy: boolean[]) {
    const floor = Math.max(0, total - maxUnavailable);
    let updated = 0;
    let aborted = false;
    while (updated < total && !aborted) {
        const size = Math.min(batchSize, total - updated);
        const available = total - size;
        if (available < floor) {
            aborted = true;
            break;
        }
        let ok = true;
        for (let i = updated; i < updated + size; i += 1) {
            if (healthy[i] === false) {
                ok = false;
            }
        }
        if (!ok) {
            aborted = true;
            break;
        }
        updated += size;
    }
    return { updated, aborted, floor };
}

describe("RollingUpdate", () => {
    it("matches an independent rollout simulation", () => {
        const input = mod.defaultInput as { total: number; batchSize: number; maxUnavailable: number; healthy: boolean[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.total);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input.total, input.batchSize, input.maxUnavailable, input.healthy);
        expect(meta["updated"]).toBe(expected.updated);
        expect(meta["aborted"]).toBe(expected.aborted);
        expect(meta["minAvailable"]).toBe(expected.floor);
    });

    it("never commits a batch that would break the availability floor", () => {
        for (const frame of [...mod.run(mod.defaultInput)]) {
            const states = frame.meta["states"] as string[];
            const updating = states.filter((s) => s === "updating").length;
            expect(updating).toBeLessThanOrEqual(2);
        }
        const meta = [...mod.run({ total: 8, batchSize: 2, maxUnavailable: 0 })].pop()!.meta;
        expect(meta["aborted"]).toBe(true);
        expect(meta["updated"]).toBe(0);
    });

    it("rolls back an unhealthy batch and leaves prior instances updated", () => {
        const meta = [...mod.run({ total: 6, batchSize: 2, maxUnavailable: 2, healthy: [true, true, false, true, true, true] })].pop()!.meta;
        expect(meta["aborted"]).toBe(true);
        expect(meta["updated"]).toBe(2);
        const states = meta["states"] as string[];
        expect(states.slice(0, 2)).toEqual(["new", "new"]);
        expect(states.slice(2)).toEqual(["old", "old", "old", "old"]);
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

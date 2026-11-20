/**
 * mcs-lock.test.ts - Queue lock correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { allAcquisitionOrders, mcsTrace } from "./mcs-lock";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent FIFO handoff check using a plain queue. */
function bruteFifo(order: number[]): number[] {
    const queue = order.slice();
    const grants: number[] = [];
    while (queue.length > 0) {
        grants.push(queue.shift() as number);
    }
    return grants;
}

describe("MCS Lock", () => {
    it("grants the lock in FIFO order for every acquisition order", () => {
        for (const order of allAcquisitionOrders(3)) {
            const trace = mcsTrace(order);
            expect(trace.grants).toEqual(bruteFifo(order));
            expect(trace.mutualExclusion).toBe(true);
            expect(trace.fifo).toBe(true);
        }
        expect(allAcquisitionOrders(3)).toHaveLength(6);
        expect(allAcquisitionOrders(4)).toHaveLength(24);
    });

    it("reports a correct trace in the final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["correct"]).toBe(true);
        expect(final?.["grants"]).toEqual([2, 0, 1]);
        expect((final?.["order"] as number[]).length).toBe(3);
    });

    it("handles a single contender without a handoff", () => {
        const trace = mcsTrace([4]);
        expect(trace.grants).toEqual([4]);
        expect(trace.events.some((event) => event.kind === "handoff")).toBe(false);
        expect(trace.mutualExclusion).toBe(true);
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

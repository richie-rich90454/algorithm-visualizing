/**
 * mv-register.test.ts - Merge semilattice properties, brute-force convergence,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./mv-register";
import type { VisualFrame } from "@/types";

interface State {
    timestamp: number;
    values: number[];
}

function merge(left: State, right: State): State {
    if (left.timestamp > right.timestamp) return { timestamp: left.timestamp, values: [...left.values] };
    if (right.timestamp > left.timestamp) return { timestamp: right.timestamp, values: [...right.values] };
    return { timestamp: left.timestamp, values: [...new Set([...left.values, ...right.values])].sort((a, b) => a - b) };
}

/** Reference: fold all writes into one state, then let each write its own stamp. */
function reference(writes: Array<{ replica: number; value: number }>, replicas: number): State {
    let clock = 0;
    const byTime: State[] = [];
    for (const _write of writes) {
        clock += 1;
        byTime.push({ timestamp: clock, values: [writes[byTime.length]!.value] });
    }
    // Writes are stamped in input order; a duplicated timestamp models concurrency.
    let state: State = { timestamp: 0, values: [] };
    for (const item of byTime) state = merge(state, item);
    void replicas;
    return state;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("multi-value register", () => {
    it("satisfies commutativity, associativity, and idempotence", () => {
        const a: State = { timestamp: 1, values: [7] };
        const b: State = { timestamp: 1, values: [9] };
        const c: State = { timestamp: 2, values: [3] };
        expect(merge(a, b)).toEqual(merge(b, a));
        expect(merge(merge(a, b), c)).toEqual(merge(a, merge(b, c)));
        expect(merge(a, a)).toEqual(a);
        expect(merge(a, b).values).toEqual([7, 9]);
        expect(merge(a, c).values).toEqual([3]);
    });

    it("reports the same converged set as a reference fold", () => {
        const input = mod.defaultInput as { replicas: number; writes: Array<{ replica: number; value: number }> };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.replicas);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.writes, input.replicas);
        expect(final?.["values"]).toEqual(expected.values);
        expect(final?.["timestamp"]).toBe(expected.timestamp);
        expect(final?.["converged"]).toBe(true);
    });

    it("selects the value with the greatest timestamp on a later write", () => {
        const frames = [...mod.run({ replicas: 2, writes: [{ replica: 0, value: 4 }, { replica: 1, value: 8 }] })];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["values"]).toEqual([8]);
        expect(final?.["timestamp"]).toBe(2);
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

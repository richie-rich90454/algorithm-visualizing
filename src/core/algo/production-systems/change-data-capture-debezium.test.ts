/**
 * change-data-capture-debezium.test.ts - Replay equality and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./change-data-capture-debezium";
import type { VisualFrame } from "@/types";

interface Change { table: string; op: number; key: number; value: number }

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["family"]).toBe("change-data-capture");
    });
}

/** Independent replay of change records into a plain map. */
function reference(changes: Change[]) {
    const state = new Map<number, number>();
    for (const change of changes) {
        if (change.op === 2) state.delete(change.key);
        else state.set(change.key, change.value);
    }
    return [...state.entries()].sort((a, b) => a[0] - b[0]);
}

describe("Change Data Capture", () => {
    it("rebuilds the exact table state from the change stream", () => {
        const changes: Change[] = [
            { table: "orders", op: 0, key: 1, value: 10 },
            { table: "orders", op: 0, key: 2, value: 20 },
            { table: "orders", op: 1, key: 1, value: 15 },
            { table: "orders", op: 2, key: 2, value: 0 },
            { table: "orders", op: 0, key: 3, value: 30 },
            { table: "orders", op: 1, key: 3, value: 35 },
        ];
        const frames = [...mod.run({ changes })];
        checkFrames(frames, changes.length);
        const meta = frames[frames.length - 1]?.meta;
        const expected = reference(changes);
        expect(meta?.["finalKeys"]).toEqual(expected.map(([key]) => key));
        expect(meta?.["finalValues"]).toEqual(expected.map(([, value]) => value));
        expect(meta?.["applied"]).toEqual(changes.map(() => 1));
        expect(meta?.["ops"]).toEqual(changes.map((c) => c.op));
        expect(meta?.["befores"]).toEqual([-1, -1, 10, 20, -1, 30]);
        expect(meta?.["afters"]).toEqual([10, 20, 15, -1, 30, 35]);
    });

    it("handles deletes and re-inserts of the same key", () => {
        const changes: Change[] = [
            { table: "t", op: 0, key: 5, value: 1 },
            { table: "t", op: 2, key: 5, value: 0 },
            { table: "t", op: 0, key: 5, value: 9 },
        ];
        const frames = [...mod.run({ changes })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["finalKeys"]).toEqual([5]);
        expect(meta?.["finalValues"]).toEqual([9]);
        expect(meta?.["befores"]).toEqual([-1, 1, -1]);
        expect(meta?.["afters"]).toEqual([1, -1, 9]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

/**
 * causal-broadcast.test.ts - Independent delivery reference, causal-order
 * property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./causal-broadcast";
import type { VisualFrame } from "@/types";

interface Msg { from: number; vector: number[] }

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(cols);
    });
}

/** Independent reference that buffers and delivers messages. */
function reference(messages: Msg[], p: number): { order: number[]; local: number[] } {
    const local = new Array<number>(p).fill(0);
    const pending = new Set<number>();
    const order: number[] = [];
    const ready = (m: Msg) =>
        (m.vector[m.from] ?? 0) === (local[m.from] ?? 0) + 1 &&
        m.vector.every((value, k) => k === m.from || value <= (local[k] ?? 0));
    for (let i = 0; i < messages.length; i += 1) {
        pending.add(i);
        let changed = true;
        while (changed) {
            changed = false;
            for (const index of [...pending]) {
                const m = messages[index]!;
                if (ready(m)) {
                    for (let k = 0; k < p; k += 1) {
                        local[k] = Math.max(local[k] ?? 0, m.vector[k] ?? 0);
                    }
                    pending.delete(index);
                    order.push(index);
                    changed = true;
                    break;
                }
            }
        }
    }
    return { order, local };
}

describe("CausalBroadcast", () => {
    it("matches an independent reference and preserves causal precedence", () => {
        const input = mod.defaultInput as { messages: Msg[]; processes: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.messages.length + 1, input.processes);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.messages, input.processes);
        expect(final?.["order"]).toEqual(expected.order);
        expect(final?.["local"]).toEqual(expected.local);
        expect(final?.["delivered"]).toBe(input.messages.length);

        const order = final?.["order"] as number[];
        for (let a = 0; a < order.length; a += 1) {
            for (let b = a + 1; b < order.length; b += 1) {
                const earlier = input.messages[order[a]!]!;
                const later = input.messages[order[b]!]!;
                if (earlier.from === later.from) {
                    expect(earlier.vector[earlier.from]).toBeLessThan(later.vector[later.from]!);
                }
            }
        }
    });

    it("buffers an early message until its cause arrives", () => {
        const messages: Msg[] = [
            { from: 2, vector: [0, 1, 1] },
            { from: 1, vector: [0, 1, 0] },
        ];
        const frames = [...mod.run({ processes: 3, messages })];
        checkFrames(frames, messages.length + 1, 3);
        const first = frames[1]?.meta;
        expect(first?.["buffer"]).toEqual([0]);
        expect(first?.["delivered"]).toBe(0);
        const second = frames[2]?.meta;
        expect(second?.["delivered"]).toBe(2);
        expect(second?.["local"]).toEqual([0, 1, 1]);
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

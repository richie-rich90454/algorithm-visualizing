/**
 * hybrid-logical-clock.test.ts - Independent HLC reference, monotonicity/ordering properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hybrid-logical-clock";
import type { VisualFrame } from "@/types";

interface ClockEvent {
    kind: "local" | "send" | "receive";
    node: string;
    wall?: number;
    remote?: [number, number];
}

type Timestamp = [number, number];

/** Independent reference implementation of the HLC update rules. */
function reference(events: ClockEvent[], walls: number[]): Timestamp[] {
    const clocks = new Map<string, Timestamp>();
    const out: Timestamp[] = [];
    for (let i = 0; i < events.length; i += 1) {
        const e = events[i]!;
        const wall = typeof e.wall === "number" ? Math.floor(e.wall) : (walls[i] ?? 0);
        const cur: Timestamp = clocks.get(e.node) ?? [0, 0];
        let next: Timestamp;
        if (e.kind === "receive") {
            const r = e.remote ?? cur;
            const m = Math.max(cur[0], r[0], wall);
            let logical: number;
            if (m === cur[0] && m === r[0]) logical = Math.max(cur[1], r[1]) + 1;
            else if (m === cur[0]) logical = cur[1] + 1;
            else if (m === r[0]) logical = r[1] + 1;
            else logical = 0;
            next = [m, logical];
        } else if (wall > cur[0]) {
            next = [wall, 0];
        } else {
            next = [cur[0], cur[1] + 1];
        }
        clocks.set(e.node, next);
        out.push(next);
    }
    return out;
}

function checkFrames(frames: VisualFrame[], events: number): void {
    expect(frames.length).toBe(events + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["events"]).toBe(index === 0 || index === events + 1 ? (index === 0 ? 0 : events) : index);
        expect(frame.entities.length).toBe((index === 0 ? 0 : Math.min(index, events)) * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("HybridLogicalClock", () => {
    it("matches an independent HLC reference on the default trace", () => {
        const input = mod.defaultInput as { wall: number[]; events: ClockEvent[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.events.length);
        const expected = reference(input.events, input.wall);
        for (let i = 0; i < expected.length; i += 1) {
            const row = frames[i + 1]!;
            expect(row.meta["physical"]).toBe(expected[i]![0]);
            expect(row.meta["logical"]).toBe(expected[i]![1]);
        }
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["done"]).toBe(true);
    });

    it("gives every event a timestamp greater than its causal predecessor on each node", () => {
        const events: ClockEvent[] = [
            { kind: "local", node: "A", wall: 10 },
            { kind: "send", node: "A", wall: 10 },
            { kind: "local", node: "B", wall: 10 },
            { kind: "receive", node: "B", wall: 10, remote: [10, 0] },
            { kind: "receive", node: "A", wall: 10, remote: [10, 1] },
            { kind: "send", node: "A", wall: 10 },
        ];
        const frames = [...mod.run({ wall: [10, 10, 10, 10, 10, 10], events })];
        const stamps: Timestamp[] = [];
        for (let i = 1; i <= events.length; i += 1) {
            const m = frames[i]!.meta;
            stamps.push([m["physical"] as number, m["logical"] as number]);
        }
        const cmp = (a: Timestamp, b: Timestamp) => a[0] - b[0] || a[1] - b[1];
        expect(cmp(stamps[0]!, stamps[1]!)).toBeLessThan(0);
        expect(cmp(stamps[2]!, stamps[3]!)).toBeLessThan(0);
        expect(cmp(stamps[4]!, stamps[5]!)).toBeLessThan(0);
        expect(cmp([10, 0], stamps[3]!)).toBeLessThan(0);
    });

    it("keeps timestamps close to wall time when the wall leads", () => {
        const frames = [...mod.run({ wall: [100, 200, 300], events: [
            { kind: "local", node: "A", wall: 100 },
            { kind: "local", node: "B", wall: 200 },
            { kind: "local", node: "C", wall: 300 },
        ] })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["maxOffset"]).toBe(0);
        expect(final?.["clocks"]).toEqual(["A=100.0", "B=200.0", "C=300.0"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});

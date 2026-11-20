/**
 * time-warp-protocol.test.ts - Final states versus an independent sequential
 * timestamp-order reference, rollback accounting, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./time-warp-protocol";
import type { VisualFrame } from "@/types";

type Event = { id: string; time: number; lp: number; value: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) expect(entity.type).toBe("bar");
    });
}

/** Independent reference: sort every event by timestamp and sum per process. */
function bruteStates(events: Event[], lps: number): number[] {
    const state = new Array<number>(lps).fill(0);
    const sorted = events.slice().sort((a, b) => a.lp - b.lp || a.time - b.time || a.id.localeCompare(b.id));
    for (const e of sorted) state[e.lp] = (state[e.lp] as number) + e.value;
    return state;
}

/** Count arrivals that are older than the highest time already seen at that LP. */
function bruteStragglers(events: Event[], lps: number): number {
    const highest = new Array<number>(lps).fill(-Infinity);
    let count = 0;
    for (const e of events) {
        if (e.time < (highest[e.lp] as number)) count += 1;
        highest[e.lp] = Math.max(highest[e.lp] as number, e.time);
    }
    return count;
}

function seeded(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 48271) % 0x7fffffff;
        return s / 0x7fffffff;
    };
}

describe("TimeWarpProtocol", () => {
    it("ends in the same state as sequential timestamp order for random arrivals", () => {
        const rand = seeded(31);
        for (let trial = 0; trial < 60; trial += 1) {
            const lps = 2 + Math.floor(rand() * 3);
            const count = 4 + Math.floor(rand() * 7);
            const events: Event[] = Array.from({ length: count }, (_, i) => ({
                id: `e${i}`,
                time: Math.floor(rand() * 20),
                lp: Math.floor(rand() * lps),
                value: Math.floor(rand() * 9) - 4,
            }));
            const frames = [...mod.run({ lps, events })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["states"]).toEqual(bruteStates(events, lps));
            expect(Number(final?.["rollbacks"])).toBeGreaterThanOrEqual(bruteStragglers(events, lps));
            expect(Number(final?.["antimessages"])).toBeGreaterThanOrEqual(0);
        }
    });

    it("rolls back on the default stragglers and still reaches the reference state", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["rollbacks"])).toBeGreaterThanOrEqual(2);
        expect(final?.["states"]).toEqual(bruteStates((mod.defaultInput as { events: Event[] }).events, 2));
        const rollbackFrames = frames.filter((f) => f.meta["phase"] === "rollback");
        expect(rollbackFrames.length).toBeGreaterThanOrEqual(2);
    });

    it("never rolls back when events already arrive in timestamp order", () => {
        const events: Event[] = [
            { id: "a", time: 1, lp: 0, value: 2 },
            { id: "b", time: 2, lp: 0, value: 3 },
            { id: "c", time: 3, lp: 1, value: 4 },
        ];
        const frames = [...mod.run({ lps: 2, events })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["rollbacks"]).toBe(0);
        expect(final?.["antimessages"]).toBe(0);
        expect(final?.["states"]).toEqual([5, 4]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});

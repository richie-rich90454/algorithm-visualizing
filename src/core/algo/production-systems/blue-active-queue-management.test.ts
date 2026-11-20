/**
 * blue-active-queue-management.test.ts - Independent BLUE reference, bounds and monotonicity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./blue-active-queue-management";
import type { VisualFrame } from "@/types";

interface QueueEvent { queueLen: number; coin?: number }
interface Params { capacity: number; increment: number; decrement: number; idleThreshold: number; freezeTime: number }

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("bar");
            const p = entity.value as number;
            expect(Number.isFinite(p)).toBe(true);
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
        }
    });
}

/** Independent recomputation of the BLUE probability series. */
function reference(events: QueueEvent[], p: Params): { probabilities: number[]; drops: number[]; kinds: string[] } {
    let prob = 0;
    let last = -p.freezeTime;
    let empty = 0;
    const probabilities: number[] = [];
    const drops: number[] = [];
    const kinds: string[] = [];
    events.forEach((ev, t) => {
        let kind = "normal";
        if (ev.queueLen >= p.capacity) { kind = "overflow"; empty = 0; }
        else if (ev.queueLen === 0) { empty += 1; if (empty >= p.idleThreshold) kind = "idle"; }
        else empty = 0;
        if (kind !== "normal" && t - last >= p.freezeTime) {
            prob += kind === "overflow" ? p.increment : -p.decrement;
            prob = Math.min(1, Math.max(0, prob));
            last = t;
        }
        const coinIn = Number(ev.coin);
        const coin = Number.isFinite(coinIn) ? Math.min(1, Math.max(0, coinIn)) : ((t * 37) % 101) / 101;
        probabilities.push(prob);
        drops.push(coin < prob ? 1 : 0);
        kinds.push(kind);
    });
    return { probabilities, drops, kinds };
}

describe("BlueActiveQueueManagement", () => {
    const defaultInput = mod.defaultInput as {
        events: QueueEvent[]; capacity: number; increment: number; decrement: number; idleThreshold: number; freezeTime: number;
    };

    it("matches an independent BLUE simulation on the default input", () => {
        const frames = [...mod.run(defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        const ref = reference(defaultInput.events, defaultInput);
        expect(last["probabilities"]).toEqual(ref.probabilities);
        expect(last["drops"]).toEqual(ref.drops);
        expect(last["kinds"]).toEqual(ref.kinds);
    });

    it("raises probability on overflow and lowers it on idle, staying in bounds", () => {
        const params: Params = { capacity: 10, increment: 0.1, decrement: 0.02, idleThreshold: 1, freezeTime: 1 };
        const events = [
            { queueLen: 20 }, { queueLen: 20 }, { queueLen: 20 },
            { queueLen: 0 }, { queueLen: 0 },
        ];
        const frames = [...mod.run({ ...params, events })];
        checkFrames(frames);
        const probs = frames[frames.length - 1]!.meta["probabilities"] as number[];
        expect(probs[0]).toBeCloseTo(0.1, 9);
        expect(probs[1]).toBeCloseTo(0.2, 9);
        expect(probs[2]).toBeCloseTo(0.3, 9);
        expect(probs[3]).toBeCloseTo(0.28, 9);
        expect(probs[4]).toBeCloseTo(0.26, 9);
        for (const p of probs) expect(p).toBeGreaterThanOrEqual(0);
        for (const p of probs) expect(p).toBeLessThanOrEqual(1);
    });

    it("clamps probability at one and zero", () => {
        const params: Params = { capacity: 5, increment: 0.5, decrement: 0.5, idleThreshold: 1, freezeTime: 1 };
        const events = [
            { queueLen: 9 }, { queueLen: 9 }, { queueLen: 9 },
            { queueLen: 0 }, { queueLen: 0 }, { queueLen: 0 },
        ];
        const frames = [...mod.run({ ...params, events })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["probabilities"]).toEqual(reference(events, params).probabilities);
        expect(last["finalProbability"] as number).toBeGreaterThanOrEqual(0);
        expect(last["finalProbability"] as number).toBeLessThanOrEqual(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

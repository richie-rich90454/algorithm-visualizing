/**
 * request-hedging.test.ts - Reference latency model, never-worse property,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./request-hedging";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function reference(primary: number, delay: number, hedgeLatency: number) {
    const sent = primary > delay;
    const hedgeCompletion = delay + hedgeLatency;
    const latency = sent ? Math.min(primary, hedgeCompletion) : primary;
    const winner = !sent || primary <= hedgeCompletion ? "primary" : "hedge";
    return { sent, hedgeCompletion, latency, winner, saved: primary - latency };
}

describe("RequestHedging", () => {
    it("matches an independent latency-model reference", () => {
        const input = mod.defaultInput as { primaryLatency: number; hedgeDelay: number; hedgeLatency: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input.primaryLatency, input.hedgeDelay, input.hedgeLatency);
        expect(meta["hedgeSent"]).toBe(expected.sent);
        expect(meta["hedgeCompletion"]).toBe(expected.hedgeCompletion);
        expect(meta["latency"]).toBe(expected.latency);
        expect(meta["winner"]).toBe(expected.winner);
        expect(meta["saved"]).toBe(expected.saved);
    });

    it("never increases latency and only hedges past the delay", () => {
        for (const [primary, delay, hedge] of [[100, 50, 20], [40, 50, 10], [100, 50, 90], [10, 5, 1]] as Array<[number, number, number]>) {
            const meta = [...mod.run({ primaryLatency: primary, hedgeDelay: delay, hedgeLatency: hedge })].pop()!.meta;
            expect(meta["hedgeSent"]).toBe(primary > delay);
            expect(meta["latency"] as number).toBeLessThanOrEqual(primary);
            expect(meta["saved"] as number).toBeGreaterThanOrEqual(0);
        }
    });

    it("sends no hedge when the primary answers before the delay", () => {
        const frames = [...mod.run({ primaryLatency: 30, hedgeDelay: 50, hedgeLatency: 10 })];
        expect(frames).toHaveLength(3);
        expect(frames.every((f) => f.meta["hedgeSent"] === false)).toBe(true);
        expect(frames[frames.length - 1]!.meta["latency"]).toBe(30);
        expect(frames[frames.length - 1]!.meta["saved"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThanOrEqual(4);
        expect(generator.next().done).toBe(true);
    });
});

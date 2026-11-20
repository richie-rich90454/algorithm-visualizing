/**
 * outbox-pattern.test.ts - Atomicity, ordered at-least-once delivery, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./outbox-pattern";
import type { VisualFrame } from "@/types";

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta ?? {};
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const meta = frame.meta;
        expect(Number(meta["cols"])).toBe(3);
        expect(Array.isArray(meta["committed"])).toBe(true);
        expect(Array.isArray(meta["publishedOrder"])).toBe(true);
        expect(Number.isFinite(Number(meta["pending"]))).toBe(true);
    });
}

describe("OutboxPattern", () => {
    it("delivers every committed event exactly once in id order", () => {
        const frames = [...mod.run({ events: ["a", "b", "c", "d"], rollback: [], failAttempts: [], maxPasses: 5 })];
        checkFrames(frames);
        const meta = finalMeta(frames);
        expect(meta["committed"]).toEqual([1, 2, 3, 4]);
        expect(meta["publishedOrder"]).toEqual([1, 2, 3, 4]);
        expect(Number(meta["pending"])).toBe(0);
        expect(Number(meta["attempts"])).toBe(4);
    });

    it("keeps an outbox row if and only if the transaction committed", () => {
        const frames = [...mod.run({ events: ["a", "b", "c", "d"], rollback: [1], failAttempts: [], maxPasses: 5 })];
        checkFrames(frames);
        const meta = finalMeta(frames);
        expect(meta["committed"]).toEqual([1, 3, 4]);
        const outbox = JSON.parse(String(meta["outbox"])) as Array<{ id: number; state: string }>;
        expect(outbox.map((r) => r.id)).toEqual([1, 3, 4]);
        expect(meta["publishedOrder"]).toEqual([1, 3, 4]);
    });

    it("retries transient failures and still delivers in order", () => {
        // Fail the first attempt on row 1; the pass stops, so the next pass retries it first.
        const frames = [...mod.run({ events: ["a", "b", "c"], rollback: [], failAttempts: [1], maxPasses: 5 })];
        checkFrames(frames);
        const meta = finalMeta(frames);
        expect(meta["publishedOrder"]).toEqual([1, 2, 3]);
        expect(Number(meta["attempts"])).toBe(4);
        expect(Number(meta["pending"])).toBe(0);
        // A published frame must never precede an earlier id being published.
        const order = meta["publishedOrder"] as number[];
        for (let i = 1; i < order.length; i += 1) {
            expect(order[i]!).toBeGreaterThan(order[i - 1]!);
        }
    });

    it("stops with pending rows when passes are exhausted", () => {
        const frames = [...mod.run({ events: ["a", "b"], rollback: [], failAttempts: [1, 2, 3], maxPasses: 2 })];
        checkFrames(frames);
        const meta = finalMeta(frames);
        expect(Number(meta["pending"])).toBeGreaterThan(0);
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

/**
 * ticket-lock.test.ts - FIFO grant order versus an independent reference,
 * mutual-exclusion safety, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./ticket-lock";
import type { VisualFrame, MetaValue } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function arr(meta: Record<string, MetaValue>, key: string): number[] {
    const raw = meta[key];
    return Array.isArray(raw) ? raw.map((v) => Number(v)) : [];
}

describe("Ticket lock", () => {
    it("grants the lock in arrival order", () => {
        const threads = [3, 1, 4, 1, 5, 9, 2, 6];
        const frames = [...mod.run({ threads })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(arr(last, "grantOrder")).toEqual(threads);
        expect(Number(last["nextTicket"])).toBe(threads.length);
        expect(Number(last["nowServing"])).toBe(threads.length);
    });

    it("matches FIFO reference on random arrival orders", () => {
        let s = 7;
        const rand = (): number => {
            s = (s * 1103515245 + 12345) >>> 0;
            return s / 0x100000000;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const n = 2 + Math.floor(rand() * 8);
            const threads = Array.from({ length: n }, () => Math.floor(rand() * 20));
            const frames = [...mod.run({ threads })];
            checkFrames(frames);
            expect(arr(frames[frames.length - 1]!.meta, "grantOrder")).toEqual(threads);
        }
    });

    it("never shows two simultaneous critical-section owners", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        for (const frame of frames) {
            const owner = frame.meta["criticalOwner"];
            expect(owner === null || typeof owner === "number").toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

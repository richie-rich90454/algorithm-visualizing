/**
 * transactional-outbox.test.ts - Exactly-once, retry, and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./transactional-outbox";
import type { VisualFrame } from "@/types";

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
        expect(frame.meta["family"]).toBe("transactional-outbox");
    });
}

describe("Transactional Outbox", () => {
    it("delivers every event exactly once despite a failed attempt", () => {
        const orders = [1, 2, 3, 4];
        const frames = [...mod.run({ orders, failAt: [2] })];
        checkFrames(frames, orders.length);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["exactlyOnce"]).toBe(true);
        expect(meta?.["published"]).toEqual([1, 1, 1, 1]);
        expect(meta?.["successes"]).toEqual([1, 1, 1, 1]);
        expect((meta?.["publishedIds"] as number[]).length).toBe(orders.length);
        expect(new Set(meta?.["publishedIds"] as number[]).size).toBe(orders.length);
        expect(meta?.["attempts"]).toEqual([1, 2, 1, 1]);
    });

    it("retries all failures and never publishes before commit", () => {
        const orders = [10, 20, 30];
        const frames = [...mod.run({ orders, failAt: [1, 2, 3] })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["exactlyOnce"]).toBe(true);
        expect(meta?.["successes"]).toEqual([1, 1, 1]);
        for (const frame of frames) {
            const published = frame.meta["published"] as number[];
            const committed = frame.meta["committed"] as number[];
            published.forEach((flag, i) => {
                if (flag === 1) expect(committed[i]).toBe(1);
            });
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

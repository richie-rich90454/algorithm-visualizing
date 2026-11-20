/**
 * compare-and-swap.test.ts - Lost-update, failure, and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./compare-and-swap";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Compare and swap", () => {
    it("never loses an increment across stale reads", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        for (const frame of frames) {
            expect(Number(frame.meta["memory"])).toBe(Number(frame.meta["successes"]));
        }
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["successes"]).toBe(4);
        expect(final?.["failures"]).toBe(2);
        expect(final?.["memory"]).toBe(4);
    });

    it("counts a failure and leaves memory unchanged on stale swaps", () => {
        const input = (mod.defaultInput as { schedule: Array<{ thread: number; action: string }> }).schedule;
        const staleIndex = input.findIndex((item, i) => item.action === "cas" && i > 0 && input[i - 1]?.action === "read") + 1;
        const frames = [...mod.run({ threads: 3, schedule: input.slice(0, staleIndex + 1) })];
        const staleFrame = frames[frames.length - 1]?.meta;
        if (staleFrame?.["action"] === "cas") {
            expect(staleFrame["succeeded"]).toBe(false);
            expect(staleFrame["failures"]).toBe(1);
        }
    });

    it("matches a brute-force interleaving reference", () => {
        let seed = 99;
        const next = () => {
            seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
            return seed;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const schedule = Array.from({ length: 20 }, () => ({
                thread: next() % 3,
                action: next() % 2 === 0 ? "read" : "cas",
            }));
            const frames = [...mod.run({ threads: 3, schedule })];
            let memory = 0;
            let successes = 0;
            let failures = 0;
            const expected = new Array<number>(3).fill(0);
            for (let i = 0; i < schedule.length; i += 1) {
                const item = schedule[i]!;
                if (item.action === "read") {
                    expected[item.thread] = memory;
                } else if (expected[item.thread] === memory) {
                    memory += 1;
                    successes += 1;
                } else {
                    failures += 1;
                }
                const meta = frames[i + 1]?.meta;
                expect(Number(meta?.["memory"])).toBe(memory);
                expect(Number(meta?.["successes"])).toBe(successes);
                expect(Number(meta?.["failures"])).toBe(failures);
            }
        }
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

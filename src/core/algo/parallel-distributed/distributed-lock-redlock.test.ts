/**
 * distributed-lock-redlock.test.ts - Brute-force majority/timing rule,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./distributed-lock-redlock";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("RedlockDistributedLock", () => {
    it("agrees with a brute-force quorum and timing rule on every subset", () => {
        for (const n of [3, 5]) {
            for (let mask = 0; mask < 1 << n; mask += 1) {
                const acquired = Array.from({ length: n }, (_, i) => ((mask >> i) & 1) === 1);
                for (const elapsed of [50, 120, 400]) {
                    const input = { masters: n, acquired, elapsed, validity: 500, drift: 20 };
                    const frames = [...mod.run(input)];
                    checkFrames(frames, n);
                    const final = frames[frames.length - 1]?.meta;
                    const quorum = Math.floor(n / 2) + 1;
                    const count = acquired.filter(Boolean).length;
                    const expected = count >= quorum && elapsed + 20 < 500;
                    expect(final?.["quorum"]).toBe(quorum);
                    expect(final?.["acquiredCount"]).toBe(count);
                    expect(final?.["majority"]).toBe(count >= quorum);
                    expect(final?.["timeOk"]).toBe(elapsed + 20 < 500);
                    expect(final?.["valid"]).toBe(expected);
                }
            }
        }
    });

    it("counts grant bars exactly once and exposes the verdict bar", () => {
        const input = mod.defaultInput as { masters: number; acquired: boolean[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.masters);
        const finalFrame = frames[frames.length - 1];
        const verdict = finalFrame?.entities[input.masters];
        expect(verdict?.id).toBe("bar-verdict");
        expect(Number(verdict?.value)).toBe(1);
        const grantBars = finalFrame?.entities.slice(0, input.masters) ?? [];
        expect(grantBars.filter((e) => Number(e.value) === 1)).toHaveLength(
            input.acquired.filter(Boolean).length,
        );
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

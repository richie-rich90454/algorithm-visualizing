/**
 * tcp-vegas.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { vegasSteps } from "./tcp-vegas";
import type { VisualFrame } from "@/types";

type Input = { rtts: number[]; baseRtt: number; cwnd: number; alpha: number; beta: number; gamma: number };

function reference(input: Input) {
    let cwnd = input.cwnd;
    let slow = true;
    return input.rtts.map((rtt, round) => {
        const expected = cwnd / input.baseRtt;
        const actual = cwnd / rtt;
        const diff = (expected - actual) * input.baseRtt;
        let phase: string;
        if (slow && diff > input.gamma) slow = false;
        if (slow) {
            cwnd *= 2;
            phase = "slow-start";
        } else if (diff < input.alpha) {
            cwnd += 1;
            phase = "increase";
        } else if (diff > input.beta) {
            cwnd = Math.max(1, cwnd - 1);
            phase = "decrease";
        } else {
            phase = "hold";
        }
        return { round, diff, cwnd, phase };
    });
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        if (index > 0) expect(frame.entities.length).toBe(rows);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("TCP Vegas", () => {
    it("matches an independent reference on random traces", () => {
        for (let seed = 1; seed <= 25; seed += 1) {
            const baseRtt = 5 + (seed % 6);
            const rtts = Array.from({ length: 4 + (seed % 10) }, (_, i) => baseRtt + ((seed * (i + 1)) % 9));
            const input: Input = { rtts, baseRtt, cwnd: 1 + (seed % 5), alpha: 1, beta: 3, gamma: 6 };
            const frames = [...mod.run(input)];
            checkFrames(frames, rtts.length);
            const expected = reference(input);
            const final = frames[frames.length - 1]!.meta;
            expect(final["windows"]).toEqual(expected.map((e) => e.cwnd));
            expect(final["phases"]).toEqual(expected.map((e) => e.phase));
            (final["diffs"] as number[]).forEach((d, i) => expect(d).toBeCloseTo(expected[i]!.diff, 10));
            expect(vegasSteps(rtts, baseRtt, input.cwnd, 1, 3, 6).map((s) => s.cwnd))
                .toEqual(expected.map((e) => e.cwnd));
        }
    });

    it("window never drops below one and rising delay eventually decreases it", () => {
        const input: Input = {
            rtts: [10, 10, 15, 25, 40, 60, 80], baseRtt: 10, cwnd: 8, alpha: 1, beta: 3, gamma: 6,
        };
        const steps = vegasSteps(input.rtts, input.baseRtt, input.cwnd, input.alpha, input.beta, input.gamma);
        steps.forEach((s) => expect(s.cwnd).toBeGreaterThanOrEqual(1));
        expect(steps.some((s) => s.phase === "decrease")).toBe(true);
    });

    it("stays in slow start while the path is empty", () => {
        const steps = vegasSteps([10, 10, 10, 10], 10, 2, 1, 3, 6);
        expect(steps.every((s) => s.phase === "slow-start")).toBe(true);
        expect(steps.map((s) => s.cwnd)).toEqual([4, 8, 16, 32]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

/**
 * tcp-congestion-control-cubic.test.ts - Independent CUBIC formula reference, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./tcp-congestion-control-cubic";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rounds: number): void {
    expect(frames.length).toBe(rounds);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(rounds);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const history = frame.meta["cwndHistory"] as number[];
        expect(history.length).toBe(index + 1);
    });
}

/** Recompute the whole window sequence from the CUBIC formulas. */
function reference(wMax0: number, beta: number, C: number, rounds: number, losses: number[]): number[] {
    const decrease = 1 - beta;
    let wMax = wMax0;
    let epochStart = 0;
    let cwnd = C * (0 - Math.cbrt((wMax * beta) / C)) ** 3 + wMax;
    const history: number[] = [];
    for (let round = 0; round < rounds; round += 1) {
        if (round > 0) {
            const t = round - epochStart;
            const k = Math.cbrt((wMax * beta) / C);
            const cubic = C * (t - k) ** 3 + wMax;
            const friendly = wMax * decrease + beta * t;
            cwnd = Math.max(cubic, friendly, wMax * decrease);
        }
        if (losses.includes(round)) {
            wMax = cwnd;
            cwnd = cwnd * decrease;
            epochStart = round;
        }
        history.push(cwnd);
    }
    return history;
}

describe("TCP CUBIC congestion control", () => {
    it("matches an independent recomputation of the window sequence", () => {
        const cases = [
            { wMax: 10, beta: 0.2, C: 0.4, rounds: 12, losses: [6] },
            { wMax: 24, beta: 0.2, C: 0.4, rounds: 20, losses: [4, 11, 17] },
            { wMax: 8, beta: 0.1, C: 0.6, rounds: 10, losses: [3] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.rounds);
            const got = frames[frames.length - 1]?.meta["cwndHistory"] as number[];
            const want = reference(testCase.wMax, testCase.beta, testCase.C, testCase.rounds, testCase.losses);
            expect(got.length).toBe(want.length);
            for (let i = 0; i < want.length; i += 1) {
                expect(got[i]).toBeCloseTo(want[i]!, 10);
            }
        }
    });

    it("has the correct cubic landmarks and multiplicative decrease", () => {
        const frames = [...mod.run({ wMax: 20, beta: 0.2, C: 0.4, rounds: 14, losses: [5, 10] })];
        checkFrames(frames, 14);
        const meta = frames[0]?.meta;
        const k = Number(meta?.["k"]);
        const wMax = 20;
        const beta = 0.2;
        const C = 0.4;
        // C * K^3 = Wmax * beta, so the curve starts at Wmax * (1 - beta).
        expect(C * k ** 3).toBeCloseTo(wMax * beta, 9);
        const cubicAtZero = C * (0 - k) ** 3 + wMax;
        expect(cubicAtZero).toBeCloseTo(wMax * (1 - beta), 9);
        expect(Number(frames[0]?.meta["lastCwnd"])).toBeCloseTo(cubicAtZero, 9);

        const history = frames[frames.length - 1]?.meta["cwndHistory"] as number[];
        // No earlier loss, so the pre-loss window at round 5 equals the no-loss trajectory.
        const preLoss = reference(20, 0.2, 0.4, 6, [])[5]!;
        expect(history[5]).toBeCloseTo(preLoss * 0.8, 9);
        // Growth resumes monotonically between loss rounds.
        for (let r = 6; r < 10; r += 1) {
            expect(history[r]!).toBeGreaterThanOrEqual(history[r - 1]! - 1e-9);
        }
    });

    it("keeps the window at or above the post-loss floor", () => {
        const frames = [...mod.run({ wMax: 10, beta: 0.2, C: 0.4, rounds: 18, losses: [2, 8, 14] })];
        checkFrames(frames, 18);
        const history = frames[frames.length - 1]?.meta["cwndHistory"] as number[];
        for (const value of history) {
            expect(value).toBeGreaterThan(0);
        }
        expect(history[3]).toBeGreaterThan(history[2]!);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(12);
        expect(generator.next().done).toBe(true);
    });
});

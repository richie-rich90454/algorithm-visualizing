/**
 * tcp-congestion-control-reno.test.ts - Independent state-machine reference,
 * phase properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./tcp-congestion-control-reno";
import type { VisualFrame } from "@/types";

/** Independent Reno round simulation. */
function reference(
    ssthresh: number,
    rounds: number,
    lossRound: number,
    lossType: string,
): number[] {
    let cwnd = 1;
    let threshold = ssthresh;
    let recoveryExit = -1;
    const series: number[] = [];
    for (let round = 0; round < rounds; round += 1) {
        if (round === recoveryExit) {
            cwnd = threshold;
            recoveryExit = -1;
        }
        series.push(cwnd);
        if (round === lossRound) {
            threshold = Math.max(2, Math.floor(cwnd / 2));
            if (lossType === "timeout") {
                cwnd = 1;
            } else {
                cwnd = threshold + 3;
                recoveryExit = round + 2;
            }
        } else if (cwnd < threshold) {
            cwnd *= 2;
        } else {
            cwnd += 1;
        }
    }
    return series;
}

function checkFrames(frames: VisualFrame[], rounds: number): void {
    expect(frames.length).toBe(rounds + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
    expect(frames[0]?.entities.length).toBe(0);
    for (let i = 1; i <= rounds; i += 1) {
        expect(frames[i]?.entities.length).toBe(i);
    }
}

describe("TCP Reno congestion control", () => {
    it("matches an independent state-machine reference", () => {
        const cases: Array<{ ssthresh: number; rounds: number; lossRound: number; lossType: string }> = [
            { ssthresh: 8, rounds: 12, lossRound: 6, lossType: "timeout" },
            { ssthresh: 8, rounds: 12, lossRound: 6, lossType: "triple-dup" },
            { ssthresh: 4, rounds: 10, lossRound: 3, lossType: "timeout" },
            { ssthresh: 16, rounds: 15, lossRound: 9, lossType: "triple-dup" },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.rounds);
            const last = frames[frames.length - 1]?.meta;
            expect(last?.["cwndSeries"]).toEqual(reference(testCase.ssthresh, testCase.rounds, testCase.lossRound, testCase.lossType));
        }
    });

    it("obeys slow start, congestion avoidance, and loss backoff", () => {
        const timeout = [...mod.run({ ssthresh: 8, rounds: 12, lossRound: 6, lossType: "timeout" })];
        let series = timeout[timeout.length - 1]?.meta["cwndSeries"] as number[];
        expect(series.slice(0, 4)).toEqual([1, 2, 4, 8]);
        expect(series[3]! + 1).toBe(series[4]);
        expect(series[7]).toBe(1);

        const dup = [...mod.run({ ssthresh: 8, rounds: 12, lossRound: 6, lossType: "triple-dup" })];
        series = dup[dup.length - 1]?.meta["cwndSeries"] as number[];
        expect(series[6]).toBe(11);
        const thresholdAfterLoss = Math.floor(series[6]! / 2);
        expect(series[7]).toBe(thresholdAfterLoss + 3);
        expect(series[8]).toBe(thresholdAfterLoss);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(14);
        expect(generator.next().done).toBe(true);
    });
});

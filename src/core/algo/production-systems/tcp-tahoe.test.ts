/**
 * tcp-tahoe.test.ts - Independent Tahoe reference, loss-reset property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./tcp-tahoe";
import type { VisualFrame } from "@/types";

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
            expect(Number.isFinite(entity.value as number)).toBe(true);
        }
    });
}

/** Independent TCP Tahoe window simulation. */
function reference(ssthresh: number, rounds: number, lossRounds: number[]): { windows: number[]; thresholds: number[]; phases: string[] } {
    let cwnd = 1;
    let threshold = ssthresh;
    const windows: number[] = [];
    const thresholds: number[] = [];
    const phases: string[] = [];
    for (let r = 0; r < rounds; r += 1) {
        if (lossRounds.includes(r)) {
            threshold = Math.max(1, Math.floor(cwnd / 2));
            cwnd = 1;
            phases.push("loss-restart");
        } else if (cwnd < threshold) {
            cwnd = Math.min(1024, cwnd * 2);
            phases.push("slow-start");
        } else {
            cwnd = Math.min(1024, cwnd + 1);
            phases.push("congestion-avoidance");
        }
        windows.push(cwnd);
        thresholds.push(threshold);
    }
    return { windows, thresholds, phases };
}

describe("TcpTahoe", () => {
    it("matches an independent Tahoe simulation on the default input", () => {
        const input = mod.defaultInput as { ssthresh: number; rounds: number; lossRounds: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        const ref = reference(input.ssthresh, input.rounds, input.lossRounds);
        expect(last["windows"]).toEqual(ref.windows);
        expect(last["thresholds"]).toEqual(ref.thresholds);
        expect(last["phases"]).toEqual(ref.phases);
        expect(last["losses"]).toBe(input.lossRounds.length);
    });

    it("resets the window to one and halves the threshold after every loss", () => {
        const input = { ssthresh: 16, rounds: 14, lossRounds: [4, 9] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["windows"]).toEqual(reference(16, 14, [4, 9]).windows);
        const windows = last["windows"] as number[];
        const phases = last["phases"] as string[];
        for (const r of input.lossRounds) {
            expect(windows[r]).toBe(1);
            expect(phases[r]).toBe("loss-restart");
        }
        expect(last["losses"]).toBe(2);
    });

    it("never has a window above the cap and reports losses correctly", () => {
        const frames = [...mod.run({ ssthresh: 4, rounds: 12, lossRounds: [] })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["windows"]).toEqual(reference(4, 12, []).windows);
        expect(last["losses"]).toBe(0);
        expect(last["finalWindow"]).toBe(14);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

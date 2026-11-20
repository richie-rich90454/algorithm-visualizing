/** tcp-westwood.test.ts - Independent sender simulation, threshold property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { westwoodStep, westwoodThreshold, type LossType } from "./tcp-westwood";
import type { VisualFrame } from "@/types";

type Sender = { cwnd: number; ssthresh: number; bandwidth: number; rttMin: number };

function reference(acked: number[], rtts: number[], losses: LossType[], initial: number) {
    let sender: Sender = { cwnd: 1, ssthresh: initial, bandwidth: 0, rttMin: Number.POSITIVE_INFINITY };
    return acked.map((a, i) => {
        const rtt = rtts[i] ?? 10;
        const rttMin = Math.min(sender.rttMin, rtt);
        const bw = sender.bandwidth === 0 ? a / rtt : 0.7 * sender.bandwidth + 0.3 * (a / rtt);
        let cwnd = sender.cwnd;
        let ssthresh = sender.ssthresh;
        const loss = losses[i] ?? "none";
        if (loss !== "none") {
            ssthresh = Math.max(2, Math.floor(bw * rttMin));
            cwnd = loss === "timeout" ? 1 : ssthresh;
        } else if (cwnd < ssthresh) {
            cwnd = Math.min(1024, cwnd * 2);
        } else {
            cwnd = Math.min(1024, cwnd + 1);
        }
        sender = { cwnd, ssthresh, bandwidth: bw, rttMin };
        return { cwnd, ssthresh, bw, rttMin, loss };
    });
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("TCP Westwood", () => {
    it("matches an independent sender-state reference", () => {
        for (let trial = 0; trial < 20; trial += 1) {
            const rounds = 8 + (trial % 7);
            const acked = Array.from({ length: rounds }, (_, i) => 2 + ((trial + i * 3) % 12));
            const rtts = Array.from({ length: rounds }, (_, i) => 5 + ((trial + i * 2) % 8));
            const losses: LossType[] = Array.from({ length: rounds }, (_, i) =>
                i === 3 ? "dupack" : i === 6 ? "timeout" : "none");
            const expected = reference(acked, rtts, losses, 8);
            let sender: Sender = { cwnd: 1, ssthresh: 8, bandwidth: 0, rttMin: Number.POSITIVE_INFINITY };
            acked.forEach((a, i) => {
                const result = westwoodStep(i, a, rtts[i]!, losses[i]!, sender);
                sender = result.next;
                expect(sender.cwnd).toBe(expected[i]!.cwnd);
                expect(sender.ssthresh).toBe(expected[i]!.ssthresh);
                expect(sender.bandwidth).toBeCloseTo(expected[i]!.bw, 10);
                expect(sender.rttMin).toBe(expected[i]!.rttMin);
            });
        }
    });

    it("uses the bandwidth-delay product and differs on loss type", () => {
        expect(westwoodThreshold(2.9, 10)).toBe(29);
        expect(westwoodThreshold(0.01, 1)).toBe(2);
        const sender: Sender = { cwnd: 16, ssthresh: 8, bandwidth: 1.5, rttMin: 10 };
        const dup = westwoodStep(0, 4, 10, "dupack", sender);
        const timeout = westwoodStep(0, 4, 10, "timeout", sender);
        expect(dup.next.cwnd).toBe(dup.next.ssthresh);
        expect(timeout.next.cwnd).toBe(1);
        expect(timeout.next.ssthresh).toBe(dup.next.ssthresh);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["done"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});

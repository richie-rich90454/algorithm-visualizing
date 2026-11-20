/** tcp-yeah.test.ts - Independent dual-mode model, mode cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./tcp-yeah";
import type { VisualFrame } from "@/types";

type Event = { type: "ack"; rtt: number } | { type: "loss" };

function reference(events: Event[], initial: number, low: number, high: number, alphaHigh: number, betaHigh: number): number[] {
    let cwnd = initial;
    let base = Number.POSITIVE_INFINITY;
    let avg = 0;
    let mode: "tcp" | "highspeed" = "tcp";
    const windows = [cwnd];
    for (const e of events) {
        if (e.type === "ack") {
            if (base === Number.POSITIVE_INFINITY) { base = e.rtt; avg = e.rtt; }
            else { base = Math.min(base, e.rtt); avg += (e.rtt - avg) / 16; }
            const q = avg - base;
            if (mode === "tcp" && q > high) { mode = "highspeed"; }
            else if (mode === "highspeed" && q < low) { mode = "tcp"; }
            cwnd += (mode === "tcp" ? 1 : alphaHigh) / cwnd;
        } else {
            cwnd *= mode === "tcp" ? 0.5 : 1 - betaHigh;
        }
        cwnd = Math.max(0.1, cwnd);
        windows.push(Number(cwnd.toFixed(6)));
    }
    return windows;
}

function checkFrames(frames: VisualFrame[], events: number): void {
    expect(frames.length).toBe(events + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(Math.min(index + 1, events + 1));
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("TcpYeah", () => {
    it("matches an independent dual-mode model", () => {
        const traces: Event[][] = [
            [
                { type: "ack", rtt: 20 }, { type: "ack", rtt: 21 }, { type: "ack", rtt: 22 },
                { type: "ack", rtt: 35 }, { type: "ack", rtt: 45 }, { type: "loss" },
                { type: "ack", rtt: 50 }, { type: "ack", rtt: 25 }, { type: "ack", rtt: 21 },
            ],
            [{ type: "ack", rtt: 10 }, { type: "ack", rtt: 60 }, { type: "loss" }, { type: "ack", rtt: 11 }],
            [{ type: "loss" }, { type: "ack", rtt: 30 }, { type: "ack", rtt: 30 }, { type: "loss" }],
        ];
        for (const events of traces) {
            const expected = reference(events, 1, 5, 15, 10, 0.1);
            const frames = [...mod.run({ events, initialCwnd: 1 })];
            checkFrames(frames, events.length);
            const actual = (frames[frames.length - 1]?.entities ?? []).map((e) => e.value as number);
            expect(actual).toEqual(expected);
        }
    });

    it("uses hysteresis and never increases the window on loss", () => {
        const events: Event[] = [
            { type: "ack", rtt: 20 }, { type: "ack", rtt: 40 }, { type: "ack", rtt: 40 },
            { type: "loss" }, { type: "ack", rtt: 21 }, { type: "ack", rtt: 20 }, { type: "loss" },
        ];
        const frames = [...mod.run({ events })];
        checkFrames(frames, events.length);
        let previous = Number(frames[0]?.meta["cwnd"]);
        for (const frame of frames.slice(1, -1)) {
            const current = Number(frame.meta["cwnd"]);
            if (frame.meta["phase"] === "loss") {
                expect(current).toBeLessThan(previous);
            }
            previous = current;
        }
        expect([...mod.run({ events })]).toEqual(frames);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBe(11);
        expect(generator.next().done).toBe(true);
    });
});

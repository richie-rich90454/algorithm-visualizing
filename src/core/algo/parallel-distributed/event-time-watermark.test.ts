/**
 * event-time-watermark.test.ts - Independent reference for late-data dropping
 * and window firing, plus frame-shape and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./event-time-watermark";
import type { VisualFrame } from "@/types";

interface StreamEvent {
    id: string;
    timestamp: number;
    value: number;
}

const SENTINEL = -1e15;

function reference(events: StreamEvent[], ws: number, lateness: number) {
    let maxTs = SENTINEL;
    let wm = SENTINEL;
    const late: string[] = [];
    const windows = new Map<number, { start: number; end: number; count: number; sum: number }>();
    const fired: string[] = [];

    const fire = () => {
        for (const w of [...windows.values()].filter((x) => x.end <= wm).sort((a, b) => a.end - b.end)) {
            windows.delete(w.end);
            fired.push(`[${w.start},${w.end}) count=${w.count} sum=${w.sum}`);
        }
    };

    for (const e of events) {
        if (e.timestamp < wm) {
            late.push(e.id);
            continue;
        }
        maxTs = Math.max(maxTs, e.timestamp);
        wm = Math.max(wm, maxTs - lateness);
        const end = Math.ceil(e.timestamp / ws) * ws;
        let w = windows.get(end);
        if (!w) {
            w = { start: end - ws, end, count: 0, sum: 0 };
            windows.set(end, w);
        }
        w.count += 1;
        w.sum += e.value;
        fire();
    }
    wm = Number.POSITIVE_INFINITY;
    fire();
    return { late, fired };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        const open = frame.meta["openWindows"] as string[];
        expect(frame.entities.length).toBe(open.length);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(typeof frame.meta["watermark"]).toBe("number");
    });
}

describe("Event-Time Watermark", () => {
    it("matches the reference on late drops and fired windows", () => {
        const input = mod.defaultInput as { events: StreamEvent[]; windowSize: number; allowedLateness: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        const expected = reference(input.events, input.windowSize, input.allowedLateness);
        expect(finalMeta["lateCount"]).toBe(expected.late.length);
        expect(finalMeta["fired"]).toEqual(expected.fired);
        expect(expected.late).toEqual(["e3"]);

        const totalFiredCount = (finalMeta["fired"] as string[])
            .map((f) => Number(f.match(/count=(\d+)/)?.[1]))
            .reduce((a, b) => a + b, 0);
        expect(totalFiredCount).toBe(input.events.length - expected.late.length);
    });

    it("keeps the watermark monotonic across every frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const watermarks = frames.map((f) => f.meta["watermark"] as number);
        for (let i = 1; i < watermarks.length; i += 1) {
            expect(watermarks[i]!).toBeGreaterThanOrEqual(watermarks[i - 1]!);
        }
    });

    it("drops every event when the lateness allowance is zero and times go backward", () => {
        const events: StreamEvent[] = [
            { id: "a", timestamp: 100, value: 1 },
            { id: "b", timestamp: 50, value: 2 },
            { id: "c", timestamp: 10, value: 3 },
        ];
        const frames = [...mod.run({ events, windowSize: 100, allowedLateness: 0 })];
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta["lateCount"]).toBe(2);
        expect(finalMeta["fired"]).toContain("[0,100) count=1 sum=1");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});

/**
 * fq-codel.test.ts - Independent CoDel reference, no-drop property for fresh
 * traffic, per-flow fairness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulate } from "./fq-codel";
import type { VisualFrame } from "@/types";

/** Independent reimplementation of the per-tick FQ-CoDel rule. */
function reference(flows: number[][], target: number, interval: number, ticks: number) {
    const queues = flows.map((q) => [...q]);
    const timer: Array<number | null> = flows.map(() => null);
    const events: Array<{ flow: number; sojourn: number; dropped: boolean }> = [];
    for (let tick = 0; tick < ticks && flows.length > 0; tick += 1) {
        const flow = tick % flows.length;
        const queue = queues[flow];
        if (!queue || queue.length === 0) continue;
        while (queue.length > 0) {
            const arrival = queue[0] ?? 0;
            const sojourn = tick - arrival;
            if (sojourn > target) {
                if (timer[flow] === null) timer[flow] = tick;
                else if (tick - (timer[flow] ?? tick) >= interval) {
                    queue.shift();
                    events.push({ flow, sojourn, dropped: true });
                    timer[flow] = null;
                    continue;
                }
            } else {
                timer[flow] = null;
            }
            queue.shift();
            events.push({ flow, sojourn, dropped: false });
            break;
        }
    }
    return events;
}

function checkFrames(frames: VisualFrame[], flowCount: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(flowCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("FQ-CoDel Queue Management", () => {
    it("matches an independent reference event for event", () => {
        const cases = [
            { flows: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], target: 4, interval: 3, ticks: 12 },
            { flows: [[0, 1, 2], [3, 4, 5]], target: 2, interval: 2, ticks: 10 },
            { flows: [[5, 5], [0, 0], [2, 3, 4]], target: 3, interval: 1, ticks: 9 },
            { flows: [[0]], target: 0, interval: 1, ticks: 4 },
        ];
        for (const testCase of cases) {
            const got = simulate(testCase).events.map((e) => ({ flow: e.flow, sojourn: e.sojourn, dropped: e.dropped }));
            expect(got).toEqual(reference(testCase.flows, testCase.target, testCase.interval, testCase.ticks));
        }
    });

    it("never drops fresh packets when the target is very large", () => {
        const flows = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        const result = simulate({ flows, target: 1000, interval: 3, ticks: 20 });
        expect(result.dropped).toBe(0);
        expect(result.events.every((event) => !event.dropped)).toBe(true);
    });

    it("shares service fairly among flows with equal fresh queues", () => {
        const flows = [[0, 0, 0, 0], [0, 0, 0, 0]];
        const result = simulate({ flows, target: 100, interval: 3, ticks: 20 });
        const perFlow = [0, 0];
        for (const event of result.events) perFlow[event.flow] = (perFlow[event.flow] ?? 0) + 1;
        expect(Math.abs((perFlow[0] ?? 0) - (perFlow[1] ?? 0))).toBeLessThanOrEqual(1);
        expect(result.served).toBe(8);
    });

    it("drops stale packets instead of sending them", () => {
        const result = simulate({ flows: [[0, 0, 0, 0, 0, 0]], target: 2, interval: 2, ticks: 12 });
        expect(result.dropped).toBeGreaterThan(0);
        expect(result.events.some((event) => event.dropped && event.sojourn > 2)).toBe(true);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});

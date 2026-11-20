/** explicit-congestion-notification.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./explicit-congestion-notification";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function reference(queue: number[], threshold: number, cwnd: number, factor: number) {
    const marks: boolean[] = [];
    const history = [cwnd];
    let window = cwnd;
    for (const length of queue) {
        const marked = length >= threshold;
        marks.push(marked);
        if (marked) window = Math.max(1, window * factor);
        history.push(window);
    }
    return { marks, history, cwnd: window };
}

describe("Explicit Congestion Notification", () => {
    it("marks queue crossings and reduces the window on the default input", () => {
        const input = mod.defaultInput as { queue: number[]; threshold: number; cwnd: number; factor: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        const expected = reference(input.queue, input.threshold, input.cwnd, input.factor);
        expect(last?.meta["marks"]).toEqual(expected.marks);
        expect(last?.meta["markedCount"]).toBe(expected.marks.filter(Boolean).length);
        expect(Number(last?.meta["cwnd"])).toBeCloseTo(expected.cwnd, 9);
    });

    it("matches a reference over random queue traces", () => {
        let seed = 31337;
        const rand = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const queue = Array.from({ length: 1 + rand(15) }, () => rand(20));
            const threshold = 1 + rand(15);
            const cwnd = 1 + rand(30);
            const factor = 0.5;
            const frames = [...mod.run({ queue, threshold, cwnd, factor })];
            const last = frames[frames.length - 1];
            const expected = reference(queue, threshold, cwnd, factor);
            expect(last?.meta["marks"]).toEqual(expected.marks);
            expect(Number(last?.meta["cwnd"])).toBeCloseTo(expected.cwnd, 9);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

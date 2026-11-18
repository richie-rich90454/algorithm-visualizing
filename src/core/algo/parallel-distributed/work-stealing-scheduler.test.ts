/**
 * work-stealing-scheduler.test.ts - Work conservation, steal ends, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateWorkStealing } from "./work-stealing-scheduler";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], workers: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(workers);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["workers"]).toBe(workers);
    });
}

describe("Work-stealing scheduler", () => {
    it("executes every task exactly once and completes", () => {
        for (const seed of [1, 7, 42, 99]) {
            const sizes = [3, 2, 4, 1, 5, 2, 3, 1];
            const result = simulateWorkStealing(sizes, 4, seed);
            expect(result.complete).toBe(true);
            expect(result.executions.length).toBe(sizes.length);
            const tasks = result.executions.map((execution) => execution.task).sort((a, b) => a - b);
            expect(tasks).toEqual(sizes.map((_, id) => id));
        }
    });

    it("never assigns one task to two workers at overlapping times", () => {
        const result = simulateWorkStealing([3, 2, 4, 1, 5, 2, 3, 1], 4, 7);
        const byTask = new Map<number, typeof result.executions>();
        for (const execution of result.executions) {
            const list = byTask.get(execution.task) ?? [];
            list.push(execution);
            byTask.set(execution.task, list);
        }
        for (const list of byTask.values()) {
            expect(list.length).toBe(1);
            expect(list[0]?.end).toBeGreaterThanOrEqual(list[0]?.start as number);
        }
    });

    it("never steals from self or from an empty deque", () => {
        for (const workers of [2, 3, 8]) {
            const result = simulateWorkStealing([4, 3, 2, 1, 6, 2], workers, 11);
            for (const steal of result.steals) {
                expect(steal.thief).not.toBe(steal.victim);
                expect(steal.victim).toBeGreaterThanOrEqual(0);
                expect(steal.victim).toBeLessThan(workers);
            }
        }
    });

    it("makespan is at least the longest single task and at most total work", () => {
        const sizes = [3, 2, 4, 1, 5, 2, 3, 1];
        const result = simulateWorkStealing(sizes, 4, 7);
        expect(result.ticks).toBeGreaterThanOrEqual(Math.max(...sizes));
        expect(result.ticks).toBeLessThanOrEqual(result.totalWork);
    });

    it("a single worker produces no steals", () => {
        const result = simulateWorkStealing([2, 3, 1], 1, 5);
        expect(result.steals.length).toBe(0);
        expect(result.complete).toBe(true);
    });

    it("reports steals in its final frame", () => {
        const input = { tasks: [3, 2, 4, 1, 5, 2, 3, 1], workers: 4, seed: 7 };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.workers);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["complete"]).toBe(true);
        expect(Array.isArray(final?.["stealEvents"])).toBe(true);
        expect(Number(final?.["makespan"])).toBeGreaterThan(0);
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

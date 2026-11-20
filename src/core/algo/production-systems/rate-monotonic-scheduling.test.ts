/**
 * rate-monotonic-scheduling.test.ts - Independent scheduling reference,
 * frame shape, correctness property, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./rate-monotonic-scheduling";
import type { VisualFrame } from "@/types";

type Task = { id: string; period: number; execution: number };

/** Independent reference: a tick-by-tick scheduler written from scratch. */
function reference(tasks: Task[]) {
    const periods = tasks.map((task) => task.period);
    let horizon = 1;
    for (const period of periods) {
        let a = horizon;
        let b = period;
        while (b !== 0) {
            const t = a % b;
            a = b;
            b = t;
        }
        horizon = Math.min(720, (horizon * period) / a);
    }
    const pending: Array<Array<{ left: number; due: number }>> = tasks.map(() => []);
    const timeline: string[] = [];
    let misses = 0;
    for (let time = 0; time < horizon; time += 1) {
        tasks.forEach((task, index) => {
            if (time % task.period === 0) {
                pending[index]?.push({ left: task.execution, due: time + task.period });
            }
        });
        for (let i = 0; i < pending.length; i += 1) {
            const keep: Array<{ left: number; due: number }> = [];
            for (const job of pending[i] ?? []) {
                if (job.due <= time && job.left > 0) {
                    misses += 1;
                } else {
                    keep.push(job);
                }
            }
            pending[i] = keep;
        }
        let ran = -1;
        for (let i = 0; i < tasks.length; i += 1) {
            const job = pending[i]?.[0];
            if (job && job.left > 0) {
                ran = i;
                job.left -= 1;
                if (job.left === 0) {
                    pending[i]?.shift();
                }
                break;
            }
        }
        timeline.push(ran < 0 ? "idle" : (tasks[ran]?.id ?? "idle"));
    }
    for (const queue of pending) {
        for (const job of queue) {
            if (job.due <= horizon && job.left > 0) {
                misses += 1;
            }
        }
    }
    const used = tasks.reduce((sum, task) => sum + task.execution / task.period, 0);
    const n = Math.max(1, tasks.length);
    const bound = n * (Math.pow(2, 1 / n) - 1);
    return { timeline, misses, horizon, used, bound };
}

function checkFrames(frames: VisualFrame[], taskCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(taskCount);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Rate Monotonic Scheduling", () => {
    it("matches an independent tick-by-tick reference on the default input", () => {
        const tasks = (mod.defaultInput as { tasks: Task[] }).tasks;
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, tasks.length);
        const expected = reference(tasks);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["gantt"]).toEqual(expected.timeline);
        expect(final?.["misses"]).toBe(expected.misses);
        expect(final?.["horizon"]).toBe(expected.horizon);
        expect(Number(final?.["utilization"])).toBeCloseTo(expected.used, 9);
        expect(Number(final?.["bound"])).toBeCloseTo(expected.bound, 9);
    });

    it("meets every deadline under the utilization bound and misses when overloaded", () => {
        const light: Task[] = [
            { id: "A", period: 4, execution: 1 },
            { id: "B", period: 8, execution: 1 },
        ];
        const heavy: Task[] = [
            { id: "A", period: 4, execution: 3 },
            { id: "B", period: 8, execution: 6 },
        ];
        const lightFinal = [...mod.run({ tasks: light })].at(-1)?.meta;
        const heavyFinal = [...mod.run({ tasks: heavy })].at(-1)?.meta;
        expect(lightFinal?.["misses"]).toBe(0);
        expect(lightFinal?.["guaranteed"]).toBe(true);
        expect(Number(heavyFinal?.["misses"])).toBeGreaterThan(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

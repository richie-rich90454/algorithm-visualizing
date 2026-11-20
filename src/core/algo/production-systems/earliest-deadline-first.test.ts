/**
 * earliest-deadline-first.test.ts - Independent EDF reference, feasibility property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./earliest-deadline-first";
import type { VisualFrame } from "@/types";

interface TaskDef { period: number; exec: number }

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
            expect(entity.metadata).toBeDefined();
        }
    });
}

/** Independent eager EDF reference: recompute the whole schedule from scratch. */
function referenceSchedule(tasks: TaskDef[], duration: number): number[] {
    const pending: Array<{ task: number; deadline: number; remaining: number }> = [];
    const out: number[] = [];
    for (let t = 0; t < duration; t += 1) {
        tasks.forEach((def, index) => {
            if (t % def.period === 0) pending.push({ task: index, deadline: t + def.period, remaining: def.exec });
        });
        for (const job of pending) if (job.deadline < t) job.remaining = 0;
        const alive = pending.filter((job) => job.remaining > 0);
        let best = -1;
        for (let i = 0; i < alive.length; i += 1) {
            if (best < 0 || alive[i]!.deadline < alive[best]!.deadline) best = i;
        }
        if (best >= 0) {
            alive[best]!.remaining -= 1;
            out.push(alive[best]!.task);
        } else {
            out.push(-1);
        }
        pending.length = 0;
        pending.push(...alive);
    }
    return out;
}

describe("EarliestDeadlineFirst", () => {
    it("matches an independent EDF simulation on the default input", () => {
        const input = mod.defaultInput as { tasks: TaskDef[]; duration: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["schedule"]).toEqual(referenceSchedule(input.tasks, input.duration));
        expect(last["misses"]).toBe(0);
        expect(last["feasible"]).toBe(true);
    });

    it("meets all deadlines whenever utilization is at most one", () => {
        const sets: TaskDef[][] = [
            [{ period: 2, exec: 1 }],
            [{ period: 4, exec: 1 }, { period: 5, exec: 2 }, { period: 6, exec: 1 }],
            [{ period: 3, exec: 1 }, { period: 6, exec: 1 }, { period: 12, exec: 3 }],
        ];
        for (const tasks of sets) {
            const frames = [...mod.run({ tasks, duration: 24 })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!.meta;
            expect(last["misses"]).toBe(0);
            expect(last["schedule"]).toEqual(referenceSchedule(tasks, 24));
        }
    });

    it("reports overload when total utilization exceeds one", () => {
        const tasks = [{ period: 3, exec: 2 }, { period: 4, exec: 3 }];
        const frames = [...mod.run({ tasks, duration: 24 })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["feasible"]).toBe(false);
        expect(last["schedule"]).toEqual(referenceSchedule(tasks, 24));
        expect(last["misses"] as number).toBeGreaterThan(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

/** multilevel-feedback-queue.test.ts - Independent queue replay, demotion, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./multilevel-feedback-queue";
import type { VisualFrame } from "@/types";

interface Proc {
    id: string;
    burst: number;
    arrival: number;
}

interface Case {
    processes: Proc[];
    levels: number;
    quanta: number[];
}

function checkFrames(frames: VisualFrame[], testCase: Case): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(testCase.processes.length);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(testCase.levels);
        expect(frame.meta["cols"]).toBe(testCase.processes.length);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function reference(testCase: Case) {
    const { processes, levels, quanta } = testCase;
    const remaining = new Map(processes.map((process) => [process.id, process.burst]));
    const queueOf = new Map(processes.map((process) => [process.id, 0]));
    const admitted = new Set<string>();
    const completion = new Map<string, number>();
    const queues: string[][] = Array.from({ length: levels }, () => []);
    const segments: Array<{ id: string; start: number; end: number }> = [];
    let time = 0;
    let finished = processes.filter((process) => process.burst === 0).length;
    for (const process of processes) {
        if (process.burst === 0) {
            completion.set(process.id, process.arrival);
        }
    }
    const totalBurst = processes.reduce((sum, process) => sum + process.burst, 0);
    const limit = totalBurst * levels + processes.length * levels + 1;
    let guard = 0;
    while (finished < processes.length && guard < limit) {
        guard += 1;
        for (const process of processes) {
            if (!admitted.has(process.id) && process.arrival <= time && (remaining.get(process.id) ?? 0) > 0) {
                admitted.add(process.id);
                queues[0]!.push(process.id);
            }
        }
        let level = -1;
        for (let index = 0; index < levels; index += 1) {
            if (queues[index]!.length > 0) {
                level = index;
                break;
            }
        }
        if (level === -1) {
            const nextArrival = Math.min(
                ...processes.filter((process) => !admitted.has(process.id)).map((process) => process.arrival),
            );
            segments.push({ id: "IDLE", start: time, end: nextArrival });
            time = nextArrival;
            continue;
        }
        const id = queues[level]!.shift()!;
        const slice = Math.min(quanta[level] ?? 1, remaining.get(id) ?? 0);
        const last = segments[segments.length - 1];
        if (last && last.id === id && last.end === time) {
            last.end = time + slice;
        } else {
            segments.push({ id, start: time, end: time + slice });
        }
        time += slice;
        remaining.set(id, (remaining.get(id) ?? 0) - slice);
        if ((remaining.get(id) ?? 0) === 0) {
            completion.set(id, time);
            finished += 1;
        } else if (level < levels - 1) {
            queues[level + 1]!.push(id);
            queueOf.set(id, level + 1);
        } else {
            queues[level]!.push(id);
        }
    }
    return {
        gantt: segments.map((segment) => `${segment.id}:${segment.start}-${segment.end}`),
        completion,
        queueOf,
        time,
    };
}

describe("MultilevelFeedbackQueue", () => {
    const cases: Case[] = [
        {
            processes: [
                { id: "P1", burst: 6, arrival: 0 },
                { id: "P2", burst: 2, arrival: 1 },
                { id: "P3", burst: 8, arrival: 2 },
            ],
            levels: 3,
            quanta: [1, 2, 4],
        },
        {
            processes: [
                { id: "A", burst: 4, arrival: 0 },
                { id: "B", burst: 1, arrival: 0 },
            ],
            levels: 2,
            quanta: [2, 3],
        },
    ];

    it("matches an independent queue-level replay", () => {
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase);
            const expected = reference(testCase);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["gantt"]).toEqual(expected.gantt);
            expect(meta?.["completion"]).toEqual(
                testCase.processes.map((process) => expected.completion.get(process.id) ?? 0),
            );
            expect(meta?.["queueOf"]).toEqual(
                testCase.processes.map((process) => expected.queueOf.get(process.id) ?? 0),
            );
            expect(meta?.["time"]).toBe(expected.time);
        }
    });

    it("demotes a job that consumes a full quantum with work remaining", () => {
        const testCase = cases[1]!;
        const frames = [...mod.run(testCase)];
        const first = frames[1]?.meta["queueOf"] as number[];
        expect(first[0]).toBe(1);
        const final = frames[frames.length - 1]?.meta["queueOf"] as number[];
        expect(final[1]).toBe(0);
    });

    it("accounts for the full CPU time and terminates", () => {
        const testCase = cases[0]!;
        const generator = mod.run(testCase);
        const frames = [...generator];
        checkFrames(frames, testCase);
        const gantt = frames[frames.length - 1]?.meta["gantt"] as string[];
        const total = gantt
            .filter((segment) => !segment.startsWith("IDLE:"))
            .reduce((sum, segment) => {
                const [, times] = segment.split(":");
                const [start, end] = (times ?? "").split("-");
                return sum + (Number(end) - Number(start));
            }, 0);
        expect(total).toBe(testCase.processes.reduce((sum, process) => sum + process.burst, 0));
        expect(generator.next().done).toBe(true);
    });
});

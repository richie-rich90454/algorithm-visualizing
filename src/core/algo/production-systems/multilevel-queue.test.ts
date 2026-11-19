/** multilevel-queue.test.ts - Independent fixed-queue replay, strict priority, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./multilevel-queue";
import type { VisualFrame } from "@/types";

interface Proc {
    id: string;
    burst: number;
    arrival: number;
    queue: number;
}

interface Case {
    processes: Proc[];
    levels: number;
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
    const { processes, levels } = testCase;
    const remaining = new Map(processes.map((process) => [process.id, process.burst]));
    const completion = new Map<string, number>();
    const queues: string[][] = Array.from({ length: levels }, () => []);
    const admitted = new Set<string>();
    const gantt: string[] = [];
    let time = 0;
    let finished = processes.filter((process) => process.burst === 0).length;
    for (const process of processes) {
        if (process.burst === 0) {
            completion.set(process.id, process.arrival);
        }
    }
    const limit = processes.reduce((sum, process) => sum + process.burst, 0) + processes.length * levels + 1;
    let guard = 0;
    while (finished < processes.length && guard < limit) {
        guard += 1;
        for (const process of processes) {
            if (!admitted.has(process.id) && process.arrival <= time && (remaining.get(process.id) ?? 0) > 0) {
                admitted.add(process.id);
                queues[process.queue]!.push(process.id);
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
            gantt.push(`IDLE:${time}-${nextArrival}`);
            time = nextArrival;
            continue;
        }
        const id = queues[level]!.shift()!;
        const slice = remaining.get(id) ?? 0;
        gantt.push(`${id}:${time}-${time + slice}`);
        time += slice;
        remaining.set(id, 0);
        completion.set(id, time);
        finished += 1;
    }
    const waiting = processes.map((process) =>
        Math.max(0, (completion.get(process.id) ?? 0) - process.arrival - process.burst),
    );
    return { gantt, completion, waiting, time };
}

describe("MultilevelQueue", () => {
    const cases: Case[] = [
        {
            processes: [
                { id: "P1", burst: 4, arrival: 0, queue: 0 },
                { id: "P2", burst: 6, arrival: 0, queue: 1 },
                { id: "P3", burst: 3, arrival: 0, queue: 2 },
            ],
            levels: 3,
        },
        {
            processes: [
                { id: "A", burst: 2, arrival: 0, queue: 1 },
                { id: "B", burst: 3, arrival: 0, queue: 0 },
                { id: "C", burst: 1, arrival: 2, queue: 0 },
            ],
            levels: 2,
        },
    ];

    it("matches an independent fixed-queue replay", () => {
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase);
            const expected = reference(testCase);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["gantt"]).toEqual(expected.gantt);
            expect(meta?.["completion"]).toEqual(
                testCase.processes.map((process) => expected.completion.get(process.id) ?? 0),
            );
            expect(meta?.["waiting"]).toEqual(expected.waiting);
            expect(meta?.["time"]).toBe(expected.time);
        }
    });

    it("drains the higher-priority queue before any lower queue", () => {
        const testCase = cases[0]!;
        const gantt = [...mod.run(testCase)].pop()?.meta["gantt"] as string[];
        expect(gantt[0]).toBe("P1:0-4");
    });

    it("keeps fixed assignments and terminates", () => {
        const testCase = cases[1]!;
        const generator = mod.run(testCase);
        const frames = [...generator];
        checkFrames(frames, testCase);
        const assignments = frames.map((frame) => JSON.stringify(frame.meta["queueOf"]));
        expect(new Set(assignments).size).toBe(1);
        expect(generator.next().done).toBe(true);
    });
});

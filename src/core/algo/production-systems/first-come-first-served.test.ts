/** first-come-first-served.test.ts - Independent replay, accounting, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./first-come-first-served";
import type { VisualFrame } from "@/types";

interface Proc {
    id: string;
    burst: number;
    arrival: number;
}

function checkFrames(frames: VisualFrame[], processes: Proc[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(processes.length);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(processes.length);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function reference(processes: Proc[]) {
    const order = processes
        .map((process, index) => ({ process, index }))
        .sort((a, b) => a.process.arrival - b.process.arrival || a.index - b.index);
    const gantt: string[] = [];
    const completion = new Map<string, number>();
    let time = 0;
    for (const { process } of order) {
        if (process.arrival > time) {
            gantt.push(`IDLE:${time}-${process.arrival}`);
            time = process.arrival;
        }
        gantt.push(`${process.id}:${time}-${time + process.burst}`);
        time += process.burst;
        completion.set(process.id, time);
    }
    const waiting = processes.map((process) =>
        Math.max(0, (completion.get(process.id) ?? 0) - process.arrival - process.burst),
    );
    const turnaround = processes.map((process) =>
        Math.max(0, (completion.get(process.id) ?? 0) - process.arrival),
    );
    return { gantt, completion, waiting, turnaround, time };
}

describe("FirstComeFirstServed", () => {
    const cases: Proc[][] = [
        [
            { id: "P1", burst: 5, arrival: 0 },
            { id: "P2", burst: 3, arrival: 1 },
            { id: "P3", burst: 4, arrival: 2 },
        ],
        [
            { id: "A", burst: 2, arrival: 4 },
            { id: "B", burst: 1, arrival: 0 },
            { id: "C", burst: 3, arrival: 1 },
        ],
        [{ id: "X", burst: 7, arrival: 0 }],
    ];

    it("matches an independent arrival-order replay", () => {
        for (const processes of cases) {
            const frames = [...mod.run({ processes })];
            checkFrames(frames, processes);
            const expected = reference(processes);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["gantt"]).toEqual(expected.gantt);
            expect(meta?.["completion"]).toEqual(
                processes.map((process) => expected.completion.get(process.id) ?? 0),
            );
            expect(meta?.["waiting"]).toEqual(expected.waiting);
            expect(meta?.["turnaround"]).toEqual(expected.turnaround);
            expect(meta?.["time"]).toBe(expected.time);
        }
    });

    it("keeps the accounting identities and total CPU time", () => {
        const processes = cases[0]!;
        const meta = [...mod.run({ processes })].pop()?.meta;
        const gantt = meta?.["gantt"] as string[];
        const cpuTotal = gantt
            .filter((segment) => !segment.startsWith("IDLE:"))
            .reduce((sum, segment) => {
                const [, times] = segment.split(":");
                const [start, end] = (times ?? "").split("-");
                return sum + (Number(end) - Number(start));
            }, 0);
        expect(cpuTotal).toBe(processes.reduce((sum, process) => sum + process.burst, 0));
        const waiting = meta?.["waiting"] as number[];
        const turnaround = meta?.["turnaround"] as number[];
        processes.forEach((process, index) => {
            expect(turnaround[index]).toBe(waiting[index]! + process.burst);
        });
    });

    it("terminates cleanly with one frame per dispatch", () => {
        const processes = cases[0]!;
        const generator = mod.run({ processes });
        const frames = [...generator];
        expect(frames.length).toBe(processes.length + 2);
        expect(generator.next().done).toBe(true);
    });
});

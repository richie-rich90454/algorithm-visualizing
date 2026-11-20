/** shortest-remaining-time-first.test.ts - Independent unit replay, preemption, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./shortest-remaining-time-first";
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
    });
}

function reference(processes: Proc[]) {
    const remaining = new Map(processes.map((process) => [process.id, process.burst]));
    const completion = new Map<string, number>();
    const segments: Array<{ id: string; start: number; end: number }> = [];
    let time = 0;
    let finished = processes.filter((process) => process.burst === 0).length;
    for (const process of processes) {
        if (process.burst === 0) {
            completion.set(process.id, process.arrival);
        }
    }
    while (finished < processes.length) {
        let best = -1;
        for (let index = 0; index < processes.length; index += 1) {
            const candidate = processes[index]!;
            if ((remaining.get(candidate.id) ?? 0) === 0 || candidate.arrival > time) {
                continue;
            }
            if (best === -1) {
                best = index;
                continue;
            }
            const current = processes[best]!;
            const candidateLeft = remaining.get(candidate.id) ?? 0;
            const currentLeft = remaining.get(current.id) ?? 0;
            if (
                candidateLeft < currentLeft ||
                (candidateLeft === currentLeft && candidate.arrival < current.arrival) ||
                (candidateLeft === currentLeft && candidate.arrival === current.arrival && index < best)
            ) {
                best = index;
            }
        }
        if (best === -1) {
            const nextArrival = Math.min(
                ...processes
                    .filter((process) => !completion.has(process.id) && process.arrival > time)
                    .map((process) => process.arrival),
            );
            segments.push({ id: "IDLE", start: time, end: nextArrival });
            time = nextArrival;
            continue;
        }
        const chosen = processes[best]!;
        remaining.set(chosen.id, (remaining.get(chosen.id) ?? 0) - 1);
        const last = segments[segments.length - 1];
        if (last && last.id === chosen.id && last.end === time) {
            last.end = time + 1;
        } else {
            segments.push({ id: chosen.id, start: time, end: time + 1 });
        }
        time += 1;
        if ((remaining.get(chosen.id) ?? 0) === 0) {
            completion.set(chosen.id, time);
            finished += 1;
        }
    }
    const gantt = segments.map((segment) => `${segment.id}:${segment.start}-${segment.end}`);
    const waiting = processes.map((process) =>
        Math.max(0, (completion.get(process.id) ?? 0) - process.arrival - process.burst),
    );
    return { gantt, completion, waiting, time };
}

describe("ShortestRemainingTimeFirst", () => {
    const cases: Proc[][] = [
        [
            { id: "P1", burst: 7, arrival: 0 },
            { id: "P2", burst: 2, arrival: 2 },
            { id: "P3", burst: 4, arrival: 4 },
        ],
        [
            { id: "A", burst: 3, arrival: 0 },
            { id: "B", burst: 5, arrival: 0 },
            { id: "C", burst: 1, arrival: 2 },
        ],
    ];

    it("matches an independent unit-by-unit replay", () => {
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
            expect(meta?.["time"]).toBe(expected.time);
        }
    });

    it("preempts a long job when a shorter one arrives", () => {
        const processes = cases[0]!;
        const gantt = [...mod.run({ processes })].pop()?.meta["gantt"] as string[];
        expect(gantt).toContain("P1:0-2");
        expect(gantt).toContain("P2:2-4");
        expect(gantt).toContain("P3:4-8");
        expect(gantt).toContain("P1:8-13");
    });

    it("terminates cleanly with one frame per time unit", () => {
        const processes: Proc[] = [
            { id: "A", burst: 2, arrival: 0 },
            { id: "B", burst: 3, arrival: 0 },
        ];
        const generator = mod.run({ processes });
        expect([...generator].length).toBe(2 + 3 + 2);
        expect(generator.next().done).toBe(true);
    });
});

/** shortest-job-first.test.ts - Independent event replay, SJF optimality, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./shortest-job-first";
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
    const gantt: string[] = [];
    let time = 0;
    while ([...remaining.values()].some((value) => value > 0)) {
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
            if (
                candidate.burst < current.burst ||
                (candidate.burst === current.burst && candidate.arrival < current.arrival) ||
                (candidate.burst === current.burst &&
                    candidate.arrival === current.arrival &&
                    index < best)
            ) {
                best = index;
            }
        }
        if (best === -1) {
            const nextArrival = Math.min(
                ...processes.filter((process) => (remaining.get(process.id) ?? 0) > 0).map((process) => process.arrival),
            );
            gantt.push(`IDLE:${time}-${nextArrival}`);
            time = nextArrival;
            continue;
        }
        const chosen = processes[best]!;
        gantt.push(`${chosen.id}:${time}-${time + chosen.burst}`);
        time += chosen.burst;
        remaining.set(chosen.id, 0);
        completion.set(chosen.id, time);
    }
    const waiting = processes.map((process) =>
        Math.max(0, (completion.get(process.id) ?? 0) - process.arrival - process.burst),
    );
    const turnaround = processes.map((process) =>
        Math.max(0, (completion.get(process.id) ?? 0) - process.arrival),
    );
    return { gantt, completion, waiting, turnaround, time };
}

describe("ShortestJobFirst", () => {
    const cases: Proc[][] = [
        [
            { id: "P1", burst: 6, arrival: 0 },
            { id: "P2", burst: 2, arrival: 0 },
            { id: "P3", burst: 4, arrival: 0 },
        ],
        [
            { id: "A", burst: 5, arrival: 0 },
            { id: "B", burst: 1, arrival: 3 },
            { id: "C", burst: 2, arrival: 1 },
        ],
    ];

    it("matches an independent event-driven replay", () => {
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

    it("beats first come first served on average waiting for equal arrivals", () => {
        const processes = cases[0]!;
        const meta = [...mod.run({ processes })].pop()?.meta;
        const average = meta?.["avgWaiting"] as number;
        const fcfsOrder = [processes[0]!, processes[1]!, processes[2]!];
        let elapsed = 0;
        let fcfsWait = 0;
        for (const process of fcfsOrder) {
            fcfsWait += elapsed;
            elapsed += process.burst;
        }
        expect(average).toBeLessThan(fcfsWait / processes.length);
    });

    it("terminates cleanly with one frame per dispatch", () => {
        const processes = cases[0]!;
        const generator = mod.run({ processes });
        expect([...generator].length).toBe(processes.length + 2);
        expect(generator.next().done).toBe(true);
    });
});

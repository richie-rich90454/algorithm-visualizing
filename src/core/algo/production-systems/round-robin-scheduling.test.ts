/**
 * round-robin-scheduling.test.ts - Independent timeline simulation, fairness
 * and accounting properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./round-robin-scheduling";
import type { VisualFrame } from "@/types";

interface Proc {
    id: string;
    burst: number;
}
interface Segment {
    id: string;
    start: number;
    end: number;
}

function checkFrames(frames: VisualFrame[], processes: Proc[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(processes.length);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(processes.length);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function segmentStrings(log: Segment[]): string[] {
    return log.map((seg) => `${seg.id}:${seg.start}-${seg.end}`);
}

function parseSegments(strings: string[]): Segment[] {
    return strings.map((s) => {
        const [id, times] = s.split(":");
        const [start, end] = (times ?? "").split("-");
        return { id: id ?? "", start: Number(start), end: Number(end) };
    });
}

/** Straightforward independent simulation of the Gantt chart. */
function reference(processes: Proc[], quantum: number) {
    const queue = processes.map((p) => p.id);
    const remaining = new Map(processes.map((p) => [p.id, p.burst]));
    const completion = new Map<string, number>();
    const gantt: Segment[] = [];
    let time = 0;
    while (queue.length > 0) {
        const id = queue.shift()!;
        const slice = Math.min(quantum, remaining.get(id)!);
        gantt.push({ id, start: time, end: time + slice });
        time += slice;
        remaining.set(id, remaining.get(id)! - slice);
        if (remaining.get(id)! > 0) {
            queue.push(id);
        } else {
            completion.set(id, time);
        }
    }
    return { gantt, completion, time };
}

describe("RoundRobinScheduling", () => {
    it("matches an independent timeline simulation", () => {
        const cases: Array<{ processes: Proc[]; quantum: number }> = [
            { processes: [{ id: "A", burst: 5 }, { id: "B", burst: 3 }, { id: "C", burst: 7 }], quantum: 2 },
            { processes: [{ id: "A", burst: 1 }, { id: "B", burst: 1 }, { id: "C", burst: 1 }], quantum: 4 },
            { processes: [{ id: "A", burst: 8 }, { id: "B", burst: 2 }], quantum: 3 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.processes);
            const meta = frames[frames.length - 1]?.meta;
            const expected = reference(testCase.processes, testCase.quantum);
            expect(meta?.["time"]).toBe(expected.time);
            expect(meta?.["gantt"]).toEqual(segmentStrings(expected.gantt));
            expect(meta?.["completion"]).toEqual(
                testCase.processes.map((p) => expected.completion.get(p.id) ?? 0),
            );
        }
    });

    it("accounts for total CPU time and the turnaround identity", () => {
        const processes = [{ id: "A", burst: 9 }, { id: "B", burst: 4 }, { id: "C", burst: 6 }];
        const frames = [...mod.run({ processes, quantum: 3 })];
        checkFrames(frames, processes);
        const meta = frames[frames.length - 1]?.meta;
        const gantt = parseSegments(meta?.["gantt"] as string[]);
        const total = gantt.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
        expect(total).toBe(processes.reduce((sum, p) => sum + p.burst, 0));
        const waiting = meta?.["waiting"] as number[];
        const turnaround = meta?.["turnaround"] as number[];
        processes.forEach((p, index) => {
            expect(waiting[index]).toBe(turnaround[index]! - p.burst);
            expect(gantt.some((seg) => seg.id === p.id)).toBe(true);
        });
    });

    it("never runs a segment longer than the quantum", () => {
        const frames = [...mod.run({ processes: [{ id: "A", burst: 7 }], quantum: 2 })];
        checkFrames(frames, [{ id: "A", burst: 7 }]);
        const gantt = parseSegments(frames[frames.length - 1]?.meta["gantt"] as string[]);
        expect(gantt.map((s) => s.end - s.start)).toEqual([2, 2, 2, 1]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(11);
        expect(generator.next().done).toBe(true);
    });
});

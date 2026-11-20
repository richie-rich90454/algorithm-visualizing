/** least-laxity-first.test.ts - Independent schedule replay, minimum-laxity invariant, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./least-laxity-first";
import type { VisualFrame } from "@/types";

interface Job { id: string; burst: number; deadline: number; arrival: number; }

function reference(jobs: Job[]) {
    const remaining = jobs.map((job) => job.burst);
    const missed = jobs.map(() => false);
    const timeline: string[] = [];
    let time = 0;
    let guard = 0;
    const totalBurst = remaining.reduce((sum, value) => sum + value, 0);
    while (remaining.some((value) => value > 0) && guard < totalBurst + jobs.length * 2 + 1) {
        guard += 1;
        let choice = -1;
        let best = Infinity;
        for (let i = 0; i < jobs.length; i += 1) {
            if (remaining[i] <= 0 || jobs[i].arrival > time) continue;
            const laxity = jobs[i].deadline - remaining[i] - time;
            if (laxity < best) { best = laxity; choice = i; }
        }
        if (choice < 0) {
            const arrivals = jobs.map((job, i) => (remaining[i] > 0 ? job.arrival : Infinity));
            const next = Math.min(...arrivals);
            if (!Number.isFinite(next)) break;
            time = next;
            continue;
        }
        remaining[choice] -= 1;
        timeline.push(jobs[choice].id);
        time += 1;
        if (remaining[choice] === 0 && time > jobs[choice].deadline) missed[choice] = true;
    }
    return { timeline, missed: jobs.filter((_job, i) => missed[i]).map((job) => job.id) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Least Laxity First", () => {
    it("matches an independent schedule replay on the default input", () => {
        const input = mod.defaultInput as { jobs: Job[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.jobs);
        expect(final?.["timeline"]).toEqual(expected.timeline);
        expect(final?.["missed"]).toEqual(expected.missed);
    });

    it("the chosen job has minimum laxity at every instant", () => {
        const input = mod.defaultInput as { jobs: Job[] };
        const frames = [...mod.run(input)];
        let time = 0;
        const remaining = input.jobs.map((job) => job.burst);
        for (const frame of frames.slice(1, -1)) {
            const timeline = frame.meta["timeline"] as string[];
            const id = timeline[timeline.length - 1];
            const chosenIndex = input.jobs.findIndex((job) => job.id === id);
            const eligible = input.jobs
                .map((job, i) => ({ i, laxity: job.deadline - (remaining[i] ?? 0) - time }))
                .filter((entry) => (remaining[entry.i] ?? 0) > 0 && (input.jobs[entry.i]?.arrival ?? 0) <= time);
            const minLaxity = Math.min(...eligible.map((entry) => entry.laxity));
            expect(eligible.find((entry) => entry.i === chosenIndex)?.laxity).toBe(minLaxity);
            remaining[chosenIndex] = (remaining[chosenIndex] ?? 0) - 1;
            time += 1;
        }
    });

    it("detects a guaranteed missed deadline", () => {
        const jobs: Job[] = [
            { id: "A", burst: 3, deadline: 1, arrival: 0 },
            { id: "B", burst: 1, deadline: 10, arrival: 0 },
        ];
        const frames = [...mod.run({ jobs })];
        expect(frames[frames.length - 1]?.meta["missed"]).toEqual(["A"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

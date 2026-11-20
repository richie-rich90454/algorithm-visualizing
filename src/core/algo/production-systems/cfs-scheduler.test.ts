/**
 * cfs-scheduler.test.ts - Independent schedule replay, fairness property, frame
 * shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./cfs-scheduler";
import type { VisualFrame } from "@/types";

interface Spec {
    name: string;
    nice: number;
}

function weight(nice: number): number {
    return 1024 / Math.pow(2, nice / 5);
}

/** Independent reference: replay the same virtual-runtime scheduling rule. */
function reference(specs: Spec[], ticks: number, quantum: number) {
    const vr = specs.map(() => 0);
    const served = specs.map(() => 0);
    const schedule: string[] = [];
    const vrHistory: number[][] = [];
    for (let t = 0; t < ticks; t += 1) {
        let best = 0;
        for (let i = 1; i < vr.length; i += 1) {
            if ((vr[i] ?? 0) < (vr[best] ?? 0)) best = i;
        }
        const w = weight(specs[best]?.nice ?? 0);
        vr[best] = (vr[best] ?? 0) + (quantum * 1024) / w;
        served[best] = (served[best] ?? 0) + quantum;
        schedule.push(specs[best]?.name ?? "");
        vrHistory.push([...vr]);
    }
    return { vr, served, schedule, vrHistory };
}

function checkFrames(frames: VisualFrame[], tasks: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(tasks);
        expect(frame.entities.every((e) => e.type === "bar" && Number.isFinite(e.value as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Completely Fair Scheduler", () => {
    it("matches an independent schedule replay for every tick", () => {
        const input = mod.defaultInput as { tasks: Spec[]; ticks: number; quantum: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.tasks.length);
        const expected = reference(input.tasks, input.ticks, input.quantum);
        const tickFrames = frames.slice(1, -1);
        expect(tickFrames.map((f) => f.meta["running"])).toEqual(expected.schedule);
        tickFrames.forEach((frame, index) => {
            expect(frame.meta["vruntimes"]).toEqual(expected.vrHistory[index]);
        });
        const last = frames[frames.length - 1]?.meta["vruntimes"] as number[];
        expect(last).toEqual(expected.vr);
    });

    it("allocates CPU shares in proportion to weights", () => {
        const specs: Spec[] = [
            { name: "fast", nice: -5 },
            { name: "mid", nice: 0 },
            { name: "slow", nice: 5 },
        ];
        const ticks = 900;
        const frames = [...mod.run({ tasks: specs, ticks, quantum: 1 })];
        const last = frames[frames.length - 1]?.meta;
        const tickMeta = frames[frames.length - 2]?.meta;
        const weights = last?.["weights"] as number[];
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const shares = specs.map((spec) => Number(tickMeta?.[`share_${spec.name}`]));
        const ideal = weights.map((w) => w / totalWeight);
        shares.forEach((share, i) => expect(share).toBeCloseTo(ideal[i] ?? 0, 2));
    });

    it("always selects the least-loaded task and terminates cleanly", () => {
        const specs: Spec[] = [
            { name: "a", nice: 0 },
            { name: "b", nice: 0 },
        ];
        const frames = [...mod.run({ tasks: specs, ticks: 10, quantum: 2 })];
        checkFrames(frames, specs.length);
        const tickFrames = frames.slice(1, -1);
        expect(tickFrames.map((f) => f.meta["running"])).toEqual(["a", "b", "a", "b", "a", "b", "a", "b", "a", "b"]);
        const generator = mod.run(mod.defaultInput);
        [...generator];
        expect(generator.next().done).toBe(true);
    });
});

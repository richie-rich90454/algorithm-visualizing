/** lottery-scheduling.test.ts - Independent draw replay, fairness property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./lottery-scheduling";
import type { VisualFrame } from "@/types";

interface Proc { id: string; tickets: number; burst: number; }

function reference(procs: Proc[], seed: number) {
    const remaining = procs.map((proc) => proc.burst);
    let rng = seed >>> 0 || 1;
    const wins = procs.map(() => 0);
    const winLog: string[] = [];
    const maxQuanta = remaining.reduce((sum, value) => sum + value, 0);
    for (let tick = 0; tick < maxQuanta; tick += 1) {
        let total = 0;
        for (let i = 0; i < procs.length; i += 1) {
            if (remaining[i] > 0) total += procs[i].tickets;
        }
        if (total <= 0) break;
        rng = (Math.imul(1103515245, rng) + 12345) >>> 1;
        const ticket = (rng % total) + 1;
        let lower = 1;
        let winner = -1;
        for (let i = 0; i < procs.length; i += 1) {
            if (remaining[i] <= 0) continue;
            if (ticket >= lower && ticket < lower + procs[i].tickets) { winner = i; break; }
            lower += procs[i].tickets;
        }
        remaining[winner] -= 1;
        wins[winner] += 1;
        winLog.push(procs[winner].id);
    }
    return { wins, winLog };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Lottery Scheduling", () => {
    it("matches an independent draw replay on the default input", () => {
        const input = mod.defaultInput as { processes: Proc[]; seed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.processes, input.seed);
        expect(final?.["winLog"]).toEqual(expected.winLog);
        expect(final?.["wins"]).toEqual(expected.wins);
        expect(expected.winLog.length).toBe(input.processes.reduce((s, p) => s + p.burst, 0));
    });

    it("gives win shares that track ticket shares over a long run", () => {
        const procs: Proc[] = [
            { id: "A", tickets: 7, burst: 700 },
            { id: "B", tickets: 2, burst: 200 },
            { id: "C", tickets: 1, burst: 100 },
        ];
        const totalDraws = 1000;
        const frames = [...mod.run({ processes: procs, seed: 99 })];
        const wins = frames[frames.length - 1]?.meta["wins"] as number[];
        expect(wins.reduce((s, w) => s + w, 0)).toBe(totalDraws);
        expect(Math.abs(wins[0] / totalDraws - 0.7)).toBeLessThan(0.06);
        expect(Math.abs(wins[1] / totalDraws - 0.2)).toBeLessThan(0.06);
        expect(Math.abs(wins[2] / totalDraws - 0.1)).toBeLessThan(0.06);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

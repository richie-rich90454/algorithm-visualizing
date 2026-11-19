/** stride-scheduling.test.ts - Independent pass replay, proportionality property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./stride-scheduling";
import type { VisualFrame } from "@/types";

interface Proc { id: string; weight: number; burst: number; }

function reference(procs: Proc[], big: number) {
    const strides = procs.map((proc) => Math.max(1, Math.floor(big / proc.weight)));
    const remaining = procs.map((proc) => proc.burst);
    const passes = procs.map(() => 0);
    const runLog: string[] = [];
    const maxQuanta = remaining.reduce((sum, value) => sum + value, 0);
    for (let tick = 0; tick < maxQuanta; tick += 1) {
        let choice = -1;
        for (let i = 0; i < procs.length; i += 1) {
            if (remaining[i] <= 0) continue;
            if (choice < 0 || passes[i] < passes[choice]) choice = i;
        }
        if (choice < 0) break;
        remaining[choice] -= 1;
        passes[choice] += strides[choice];
        runLog.push(procs[choice].id);
    }
    return { strides, passes, runLog };
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

describe("Stride Scheduling", () => {
    it("matches an independent pass replay on the default input", () => {
        const input = mod.defaultInput as { processes: Proc[]; big: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.processes, input.big);
        expect(final?.["strides"]).toEqual(expected.strides);
        expect(final?.["passes"]).toEqual(expected.passes);
        expect(final?.["runLog"]).toEqual(expected.runLog);
    });

    it("advances only the chosen pass by exactly its stride", () => {
        const input = mod.defaultInput as { processes: Proc[]; big: number };
        const frames = [...mod.run(input)];
        const strides = frames[0]?.meta["strides"] as number[];
        for (let f = 2; f < frames.length - 1; f += 1) {
            const before = frames[f - 1]?.meta["passes"] as number[];
            const after = frames[f]?.meta["passes"] as number[];
            const chosen = Number(frames[f]?.meta["chosen"]);
            for (let i = 0; i < before.length; i += 1) {
                const delta = (after[i] ?? 0) - (before[i] ?? 0);
                expect(delta).toBe(i === chosen ? strides[chosen] : 0);
            }
        }
    });

    it("allocates CPU roughly in proportion to weight", () => {
        const procs: Proc[] = [
            { id: "A", weight: 4, burst: 80 },
            { id: "B", weight: 2, burst: 40 },
            { id: "C", weight: 1, burst: 20 },
        ];
        const frames = [...mod.run({ processes: procs, big: 10000 })];
        const runLog = frames[frames.length - 1]?.meta["runLog"] as string[];
        const counts = new Map<string, number>();
        for (const id of runLog) counts.set(id, (counts.get(id) ?? 0) + 1);
        expect(counts.get("A")).toBe(80);
        expect(counts.get("B")).toBe(40);
        expect(counts.get("C")).toBe(20);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

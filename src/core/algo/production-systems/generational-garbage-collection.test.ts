/**
 * generational-garbage-collection.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./generational-garbage-collection";
import type { VisualFrame } from "@/types";

function trace(seeds: string[], refs: Record<string, string[]>, alive: Set<string>): Set<string> {
    const seen = new Set<string>();
    const stack = seeds.filter((id) => alive.has(id));
    while (stack.length > 0) {
        const id = stack.pop();
        if (id === undefined || seen.has(id)) continue;
        seen.add(id);
        for (const next of refs[id] ?? []) if (alive.has(next) && !seen.has(next)) stack.push(next);
    }
    return seen;
}

function reference(objects: string[], gens: number[], refs: Record<string, string[]>, roots: string[]) {
    const gen = gens.slice();
    const alive = new Set(objects);
    const collected: string[] = [];
    const old = objects.filter((id) => alive.has(id) && gen[objects.indexOf(id)] === 1);
    const minorSeen = trace([...roots, ...old], refs, alive);
    for (const id of objects) {
        if (alive.has(id) && gen[objects.indexOf(id)] === 0) {
            if (minorSeen.has(id)) gen[objects.indexOf(id)] = 1;
            else { alive.delete(id); collected.push(id); }
        }
    }
    const majorSeen = trace(roots, refs, alive);
    for (const id of objects) {
        if (alive.has(id) && !majorSeen.has(id)) { alive.delete(id); collected.push(id); }
    }
    return { collected, alive, generations: objects.map((id) => (alive.has(id) ? gen[objects.indexOf(id)] : -1)) };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Generational garbage collection", () => {
    it("matches an independent reference for survivors, collection, and generations", () => {
        const cases: Array<{ objects: string[]; generations: number[]; refs: Record<string, string[]>; roots: string[] }> = [
            {
                objects: ["A", "B", "C", "D", "E", "F", "G"],
                generations: [0, 0, 0, 1, 1, 0, 0],
                refs: { A: ["B"], B: ["C"], C: [], D: ["E"], E: [], F: ["G"], G: [] },
                roots: ["A"],
            },
            {
                objects: ["P", "Q", "R", "S"],
                generations: [0, 1, 1, 0],
                refs: { P: ["Q"], Q: ["R"], R: [], S: [] },
                roots: ["P"],
            },
            {
                objects: ["X", "Y"],
                generations: [0, 0],
                refs: { X: ["Y"], Y: [] },
                roots: [],
            },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)] as VisualFrame[];
            checkFrames(frames, input.objects.length);
            const expected = reference(input.objects, input.generations, input.refs, input.roots);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(new Set(finalMeta?.["collected"] as string[])).toEqual(new Set(expected.collected));
            expect(finalMeta?.["generations"]).toEqual(expected.generations);
            expect(Number(finalMeta?.["aliveCount"])).toBe(expected.alive.size);
        }
    });

    it("promotes a young object referenced by an old object", () => {
        const input = {
            objects: ["Root", "Old", "Young", "Garbage"],
            generations: [1, 1, 0, 0],
            refs: { Root: ["Old"], Old: ["Young"], Young: [], Garbage: [] },
            roots: ["Root"],
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, 4);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(new Set(finalMeta?.["collected"] as string[])).toEqual(new Set(["Garbage"]));
        expect(finalMeta?.["generations"]).toEqual([1, 1, 1, -1]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

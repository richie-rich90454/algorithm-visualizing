/** redo-log.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./redo-log";
import type { VisualFrame } from "@/types";

type Update = { page: string; value: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function committed(pages: Record<string, number>, updates: Update[]): Record<string, number> {
    const result = { ...pages };
    for (const update of updates) result[update.page] = update.value;
    return result;
}

describe("Redo Log", () => {
    it("reconstructs the committed state after a simulated crash", () => {
        const input = mod.defaultInput as { pages: Record<string, number>; updates: Update[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(last?.meta["recovered"]).toBe(true);
        expect(last?.meta["db"]).toEqual(committed(input.pages, input.updates));
        expect(last?.meta["logSize"]).toBe(input.updates.length);

        const crash = frames.find((frame) => frame.meta["phase"] === "crash");
        expect(crash?.meta["db"]).toEqual(input.pages);
    });

    it("matches a reference over random update sequences", () => {
        let seed = 9876;
        const rand = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const pages: Record<string, number> = { A: rand(20), B: rand(20), C: rand(20) };
            const updates: Update[] = [];
            const count = 1 + rand(8);
            for (let i = 0; i < count; i += 1) {
                updates.push({ page: ["A", "B", "C"][rand(3)] as string, value: rand(100) });
            }
            const frames = [...mod.run({ pages, updates })];
            const last = frames[frames.length - 1];
            expect(last?.meta["db"]).toEqual(committed(pages, updates));
            expect(last?.meta["recovered"]).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

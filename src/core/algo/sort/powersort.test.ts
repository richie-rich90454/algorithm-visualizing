/** powersort.test.ts - Brute-force sorting check, run structure, and frames. */

import { describe, expect, it } from "vitest";
import mod from "./powersort";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities).toHaveLength(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Powersort", () => {
    it("matches a reference sort on fixed and deterministic random inputs", () => {
        const cases: number[][] = [
            [],
            [1],
            [2, 1],
            [1, 2, 3, 4, 5],
            [5, 4, 3, 2, 1],
            [4, 5, 7, 1, 2, 3, 9, 8, 6, 0],
        ];
        let state = 2026;
        const random = (): number => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 4294967296;
        };
        for (let t = 0; t < 30; t += 1) {
            const len = 2 + Math.floor(random() * 14);
            cases.push(Array.from({ length: len }, () => Math.floor(random() * 21) - 10));
        }
        for (const arr of cases) {
            const before = [...arr];
            const frames = [...mod.run({ values: arr })];
            checkFrames(frames, arr.length);
            expect(arr).toEqual(before);
            const last = frames[frames.length - 1] as VisualFrame;
            expect(last.entities.map((e) => Number(e.value))).toEqual([...arr].sort((a, b) => a - b));
            expect(last.meta["sorted"]).toBe(true);
        }
    });

    it("detects natural runs and assigns boundary powers", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const runFrame = frames.find((f) => f.description.includes("natural run"));
        expect(runFrame).toBeDefined();
        expect(Number(runFrame?.meta["runs"])).toBeGreaterThan(1);
        const powerFrames = frames.filter((f) => typeof f.meta["power"] === "number");
        expect(powerFrames.length).toBeGreaterThan(0);
        expect(powerFrames.every((f) => Number(f.meta["power"]) >= 0)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(generator.next().done).toBe(true);
        expect(frames.length).toBeGreaterThan(0);
    });
});

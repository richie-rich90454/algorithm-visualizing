/** t-gate.test.ts - Independent phase, unitarity, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./t-gate";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const probabilities = frame.meta["probabilities"] as number[];
        expect(probabilities).toHaveLength(2);
        expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 9);
    });
}

function amplitudes(frame: VisualFrame): [number, number, number, number] {
    const value = (id: string): number => Number(frame.entities.find((entity) => entity.id === id)?.value ?? 0);
    return [value("re-0"), value("im-0"), value("re-1"), value("im-1")];
}

describe("T Gate", () => {
    it("applies the pi over eight phase exactly k times", () => {
        for (let k = 0; k <= 8; k += 1) {
            const frames = [...mod.run({ basis: 1, repeats: k })];
            checkFrames(frames);
            const [re0, im0, re1, im1] = amplitudes(frames[k] ?? frames[frames.length - 1]!);
            expect(re0).toBeCloseTo(0, 9);
            expect(im0).toBeCloseTo(0, 9);
            expect(re1).toBeCloseTo(Math.cos((k * Math.PI) / 4), 9);
            expect(im1).toBeCloseTo(Math.sin((k * Math.PI) / 4), 9);
        }
    });

    it("returns to the initial state after eight applications and squares to S", () => {
        const full = [...mod.run({ superposed: true, repeats: 8 })];
        checkFrames(full);
        const start = amplitudes(full[0]!).slice();
        const end = amplitudes(full[8]!);
        end.forEach((value, index) => expect(value).toBeCloseTo(start[index] ?? 0, 9));

        const squared = [...mod.run({ superposed: true, repeats: 2 })];
        const half = amplitudes(squared[2]!);
        expect(half[0]).toBeCloseTo(Math.SQRT1_2, 9);
        expect(half[1]).toBeCloseTo(0, 9);
        expect(half[2]).toBeCloseTo(0, 9);
        expect(half[3]).toBeCloseTo(Math.SQRT1_2, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});

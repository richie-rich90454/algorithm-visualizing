/** s-gate.test.ts - Independent phase, Z relation, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./s-gate";

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
        expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 9);
    });
}

function amplitudes(frame: VisualFrame): [number, number, number, number] {
    const value = (id: string): number => Number(frame.entities.find((entity) => entity.id === id)?.value ?? 0);
    return [value("re-0"), value("im-0"), value("re-1"), value("im-1")];
}

describe("S Gate", () => {
    it("multiplies the one amplitude by i exactly k times", () => {
        for (let k = 0; k <= 4; k += 1) {
            const frames = [...mod.run({ basis: 1, repeats: k })];
            checkFrames(frames);
            const [re0, im0, re1, im1] = amplitudes(frames[k] ?? frames[frames.length - 1]!);
            expect(re0).toBeCloseTo(0, 9);
            expect(im0).toBeCloseTo(0, 9);
            expect(re1).toBeCloseTo(Math.cos((k * Math.PI) / 2), 9);
            expect(im1).toBeCloseTo(Math.sin((k * Math.PI) / 2), 9);
        }
    });

    it("maps the plus state to the minus state after two applications", () => {
        const frames = [...mod.run({ superposed: true, repeats: 2 })];
        checkFrames(frames);
        const result = amplitudes(frames[2]!);
        expect(result[0]).toBeCloseTo(Math.SQRT1_2, 9);
        expect(result[1]).toBeCloseTo(0, 9);
        expect(result[2]).toBeCloseTo(-Math.SQRT1_2, 9);
        expect(result[3]).toBeCloseTo(0, 9);
        const full = [...mod.run({ superposed: true, repeats: 4 })];
        const returned = amplitudes(full[4]!);
        returned.forEach((value, index) => expect(value).toBeCloseTo(amplitudes(full[0]!)[index] ?? 0, 9));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});

/**
 * quantum-walk.test.ts - Independent walk simulation, exact small cases, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-walk";
import type { VisualFrame } from "@/types";

type Spinor = [number, number];

function reference(steps: number, initial: string): Map<number, number> {
    const s = Math.SQRT1_2;
    let state = new Map<number, Spinor>();
    if (initial === "left") state.set(0, [1, 0]);
    else if (initial === "plus") state.set(0, [s, s]);
    else state.set(0, [0, 1]);
    for (let t = 0; t < steps; t += 1) {
        const next = new Map<number, Spinor>();
        for (const [position, spinor] of state) {
            const c0 = (spinor[0]! + spinor[1]!) * s;
            const c1 = (spinor[0]! - spinor[1]!) * s;
            const left = next.get(position - 1) ?? [0, 0];
            left[0] = left[0]! + c0;
            next.set(position - 1, left);
            const right = next.get(position + 1) ?? [0, 0];
            right[1] = right[1]! + c1;
            next.set(position + 1, right);
        }
        state = next;
    }
    const probabilities = new Map<number, number>();
    for (const [position, spinor] of state) {
        probabilities.set(position, spinor[0]! ** 2 + spinor[1]! ** 2);
    }
    return probabilities;
}

function probabilitiesOf(frame: VisualFrame): Map<number, number> {
    const flat = frame.meta["probabilities"] as number[];
    const result = new Map<number, number>();
    for (let i = 0; i + 1 < flat.length; i += 2) result.set(flat[i] ?? 0, flat[i + 1] ?? 0);
    return result;
}

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBe(steps + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2 * steps + 1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const probabilities = probabilitiesOf(frame);
        let total = 0;
        for (const probability of probabilities.values()) total += probability;
        expect(total).toBeCloseTo(1, 10);
        const usedStep = index === 0 ? 0 : Math.min(index, steps);
        for (const position of probabilities.keys()) {
            expect(Math.abs(position)).toBeLessThanOrEqual(usedStep);
            expect(Math.abs(position) % 2).toBe(usedStep % 2);
        }
    });
}

describe("QuantumWalk", () => {
    it("matches an independent simulator for all small cases", () => {
        for (const initial of ["right", "left", "plus"]) {
            for (const steps of [0, 1, 2, 4, 6]) {
                const frames = [...mod.run({ steps, initial })];
                checkFrames(frames, steps);
                const expected = reference(steps, initial);
                const final = probabilitiesOf(frames[frames.length - 1]!);
                expect([...final.keys()].sort((a, b) => a - b)).toEqual(
                    [...expected.keys()].sort((a, b) => a - b),
                );
                for (const [position, probability] of expected) {
                    expect(final.get(position)).toBeCloseTo(probability, 10);
                }
            }
        }
    });

    it("produces the exact textbook distribution for the first two steps", () => {
        const one = probabilitiesOf([...mod.run({ steps: 1, initial: "right" })][1]!);
        expect(one.get(-1)).toBeCloseTo(0.5, 12);
        expect(one.get(1)).toBeCloseTo(0.5, 12);

        const two = probabilitiesOf([...mod.run({ steps: 2, initial: "right" })][2]!);
        expect(two.get(-2)).toBeCloseTo(0.25, 12);
        expect(two.get(0)).toBeCloseTo(0.5, 12);
        expect(two.get(2)).toBeCloseTo(0.25, 12);
    });

    it("reports a spread that grows with the number of steps", () => {
        const frames = [...mod.run({ steps: 5, initial: "right" })];
        expect(frames[frames.length - 1]?.meta["spread"]).toBe(5);
        expect(frames[1]?.meta["spread"]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});

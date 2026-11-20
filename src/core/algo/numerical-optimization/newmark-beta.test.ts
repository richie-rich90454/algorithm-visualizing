/**
 * newmark-beta.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./newmark-beta";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(typeof frame.meta["displacement"]).toBe("number");
    });
}

describe("Newmark-Beta Integration", () => {
    it("tracks the exact undamped oscillator solution", () => {
        const input = mod.defaultInput as { mass: number; stiffness: number; steps: number; dt: number; displacement: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        const omega = Math.sqrt(input.stiffness / input.mass);
        const exact = input.displacement * Math.cos(omega * input.steps * input.dt);
        expect(last?.["exactAvailable"]).toBe(true);
        expect(last?.["displacement"] as number).toBeCloseTo(exact, 2);
    });

    it("conserves energy when damping is zero", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const firstEnergy = frames[0]?.meta["energy"] as number;
        const lastEnergy = frames[frames.length - 1]?.meta["energy"] as number;
        expect(lastEnergy).toBeCloseTo(firstEnergy, 6);
    });

    it("decreases energy when damping is positive", () => {
        const input = { ...(mod.defaultInput as object), damping: 0.6 };
        const frames = [...mod.run(input)];
        const firstEnergy = frames[0]?.meta["energy"] as number;
        const lastEnergy = frames[frames.length - 1]?.meta["energy"] as number;
        expect(lastEnergy).toBeLessThan(firstEnergy);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

/**
 * spin-echo.test.ts - Independent phase/coherence calculation, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./spin-echo";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function coherence(phases: number[]): number {
    const re = phases.reduce((sum, phase) => sum + Math.cos(phase), 0) / phases.length;
    const im = phases.reduce((sum, phase) => sum + Math.sin(phase), 0) / phases.length;
    return Math.hypot(re, im);
}

describe("SpinEcho", () => {
    it("refocuses every static detuning exactly", () => {
        const detunings = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
        const tau = 0.5;
        const frames = [...mod.run({ detunings, tau })];
        checkFrames(frames, detunings.length);
        const meta = frames[frames.length - 1]?.meta;
        const echoPhases = meta?.["phases"] as number[];
        for (const phase of echoPhases) expect(phase).toBeCloseTo(0, 12);
        expect(meta?.["echoMagnitude"] as number).toBeCloseTo(1, 12);

        const freePhases = detunings.map((delta) => 4 * delta * tau);
        expect(meta?.["freeMagnitude"] as number).toBeCloseTo(coherence(freePhases), 12);
        expect(meta?.["freeMagnitude"] as number).toBeLessThan(1);
    });

    it("an ensemble with identical detunings has no free-induction decay", () => {
        const frames = [...mod.run({ detunings: [2, 2, 2, 2], tau: 0.3 })];
        checkFrames(frames, 4);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["freeMagnitude"] as number).toBeCloseTo(1, 12);
        expect(meta?.["echoMagnitude"] as number).toBeCloseTo(1, 12);
    });

    it("echo phase is zero for arbitrary tau", () => {
        for (const tau of [0.01, 0.1, 1, 3.7]) {
            const frames = [...mod.run({ detunings: [-3, 0, 5], tau })];
            const phases = frames[frames.length - 1]?.meta["phases"] as number[];
            for (const phase of phases) expect(phase).toBeCloseTo(0, 12);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});

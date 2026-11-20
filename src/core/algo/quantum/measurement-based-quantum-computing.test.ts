/**
 * measurement-based-quantum-computing.test.ts - State-teleportation property
 * checks across input states and measurement outcomes, plus frame-shape and
 * termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./measurement-based-quantum-computing";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(7);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const probs = frame.meta["probabilities"] as number[];
        expect(Math.abs(probs.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-8);
    });
}

describe("Measurement-Based Quantum Computing", () => {
    it("teleports several input states to the output up to a global phase", () => {
        for (const theta of [0, Math.PI / 4, Math.PI / 3, Math.PI / 2, (2 * Math.PI) / 3]) {
            for (const seed of [1, 2, 3, 7]) {
                const frames = [...mod.run({ theta, seed })];
                checkFrames(frames);
                const meta = frames[frames.length - 1]?.meta;
                const out = meta["outputAmplitudes"] as number[];
                const expected = [Math.cos(theta / 2), Math.sin(theta / 2)];
                const direct = Math.hypot(out[0]! - expected[0]!, out[1]! - expected[1]!);
                const flipped = Math.hypot(out[0]! + expected[0]!, out[1]! + expected[1]!);
                expect(Math.min(direct, flipped)).toBeLessThan(1e-6);
                expect([0, 1]).toContain(meta["middleOutcome"]);
                expect([0, 1]).toContain(meta["inputOutcome"]);
            }
        }
    });

    it("exercises both measurement outcome branches", () => {
        const outcomes = new Set<string>();
        for (let seed = 0; seed < 40; seed += 1) {
            const frames = [...mod.run({ theta: Math.PI / 3, seed })];
            const meta = frames[frames.length - 1]?.meta;
            outcomes.add(`${meta["middleOutcome"]}${meta["inputOutcome"]}`);
        }
        expect(outcomes.size).toBeGreaterThan(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});

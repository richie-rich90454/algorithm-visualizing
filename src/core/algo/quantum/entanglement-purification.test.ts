/**
 * entanglement-purification.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./entanglement-purification";
import type { VisualFrame } from "@/types";

function nextFidelity(f: number): number {
    const q = 1 - f;
    return (f * f + (q * q) / 9) / (f * f + (2 * f * q) / 3 + (5 * q * q) / 9);
}

function successProbability(f: number): number {
    const q = 1 - f;
    return f * f + (2 * f * q) / 3 + (5 * q * q) / 9;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Entanglement Purification", () => {
    it("matches an independent closed-form replay", () => {
        const frames = [...mod.run({ fidelity: 0.8, rounds: 6, pairs: 1000 })];
        checkFrames(frames);
        let f = 0.8;
        const history = frames.slice(1, -1);
        for (const frame of history) {
            f = nextFidelity(f);
            expect(Number(frame.meta["fidelity"])).toBeCloseTo(f, 10);
        }
    });

    it("increases fidelity above one half and keeps probabilities valid", () => {
        const frames = [...mod.run({ fidelity: 0.8, rounds: 6, pairs: 1000 })];
        const finite = frames.slice(1, -1);
        let previous = 0.8;
        for (const frame of finite) {
            const fidelity = Number(frame.meta["fidelity"]);
            const probability = Number(frame.meta["probability"]);
            expect(fidelity).toBeGreaterThanOrEqual(previous);
            expect(probability).toBeGreaterThan(0);
            expect(probability).toBeLessThanOrEqual(1);
            previous = fidelity;
        }
        expect(Number(frames[frames.length - 1]?.meta["fidelity"])).toBeGreaterThan(0.8);
    });

    it("leaves fidelity unchanged at the fixed point one half", () => {
        const frames = [...mod.run({ fidelity: 0.5, rounds: 4, pairs: 1000 })];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["fidelity"])).toBeCloseTo(0.5, 10);
    });

    it("stops when fewer than two pairs remain", () => {
        const frames = [...mod.run({ fidelity: 0.6, rounds: 20, pairs: 4 })];
        const count = frames.filter((f) => f.description.startsWith("Round")).length;
        expect(count).toBeLessThanOrEqual(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

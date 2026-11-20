/**
 * gibbs-state-preparation.test.ts - Distribution correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./gibbs-state-preparation";
import type { VisualFrame } from "@/types";

function reference(energies: number[], beta: number) {
    const min = Math.min(...energies);
    const weights = energies.map((e) => Math.exp(-beta * (e - min)));
    const z = weights.reduce((a, b) => a + b, 0);
    const probabilities = weights.map((w) => w / z);
    const meanEnergy = probabilities.reduce((s, p, i) => s + p * energies[i]!, 0);
    let entropy = 0;
    for (const p of probabilities) if (p > 0) entropy -= p * Math.log(p);
    return { probabilities, z, meanEnergy, entropy };
}

function checkFrames(frames: VisualFrame[], levels: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(levels);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Gibbs state preparation", () => {
    it("matches an independent Boltzmann reference", () => {
        const energies = [0, 0.5, 1, 1.5];
        const beta = 1.5;
        const frames = [...mod.run({ energies, beta })];
        checkFrames(frames, energies.length);
        const final = frames[frames.length - 1]!.meta;
        const expected = reference(energies, beta);
        expect(Number(final["partition"])).toBeCloseTo(expected.z, 10);
        expect(Number(final["meanEnergy"])).toBeCloseTo(expected.meanEnergy, 10);
        expect(Number(final["entropy"])).toBeCloseTo(expected.entropy, 10);
        const probabilities = final["probabilities"] as number[];
        for (let i = 0; i < energies.length; i += 1) {
            expect(probabilities[i]).toBeCloseTo(expected.probabilities[i]!, 10);
        }
        expect(probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    });

    it("obeys temperature limits and monotonicity", () => {
        const energies = [0, 1, 2];
        const hot = [...mod.run({ energies, beta: 0 })];
        const hotP = hot[hot.length - 1]!.meta["probabilities"] as number[];
        for (const p of hotP) expect(p).toBeCloseTo(1 / 3, 10);

        let previousGround = 0;
        let previousMean = Infinity;
        let previousEntropy = Infinity;
        for (const beta of [0.5, 1, 2, 4]) {
            const frames = [...mod.run({ energies, beta })];
            const final = frames[frames.length - 1]!.meta;
            const probs = final["probabilities"] as number[];
            expect(probs[0]!).toBeGreaterThan(previousGround);
            expect(Number(final["meanEnergy"])).toBeLessThan(previousMean);
            expect(Number(final["entropy"])).toBeLessThan(previousEntropy);
            previousGround = probs[0]!;
            previousMean = Number(final["meanEnergy"]);
            previousEntropy = Number(final["entropy"]);
        }
    });

    it("handles negative energies through the shift", () => {
        const a = [...mod.run({ energies: [-1, 0, 1], beta: 1 })];
        const b = [...mod.run({ energies: [0, 1, 2], beta: 1 })];
        const pa = a[a.length - 1]!.meta["probabilities"];
        const pb = b[b.length - 1]!.meta["probabilities"];
        expect(pa).toEqual(pb);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

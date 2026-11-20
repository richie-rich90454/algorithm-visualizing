/**
 * gaussian-mechanism-differential-privacy.test.ts - Independent noise replay,
 * statistical property, privacy-calibration, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./gaussian-mechanism-differential-privacy";
import type { VisualFrame } from "@/types";

function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function normal(rng: () => number): number {
    return Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node" && Number.isFinite(e.y as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Gaussian Mechanism (Differential Privacy)", () => {
    it("matches an independent noise replay, including sigma", () => {
        const input = mod.defaultInput as {
            value: number;
            sensitivity: number;
            epsilon: number;
            delta: number;
            releases: number;
            seed: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const sigma = (input.sensitivity * Math.sqrt(2 * Math.log(1.25 / input.delta))) / input.epsilon;
        const rng = makeRng(input.seed);
        const expected: number[] = [];
        for (let i = 0; i < input.releases; i += 1) expected.push(input.value + sigma * normal(rng));
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["sigma"])).toBeCloseTo(sigma, 12);
        const actual = last?.["releasedValues"] as number[];
        expect(actual.length).toBe(expected.length);
        actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i] ?? 0, 12));
    });

    it("has near-zero mean noise and spread matching sigma", () => {
        const frames = [...mod.run({ releases: 800, seed: 99, epsilon: 1, delta: 1e-5, sensitivity: 0.1 })];
        const noises = frames.slice(1, -1).map((f) => Number(f.meta["noise"]));
        const sigma = (0.1 * Math.sqrt(2 * Math.log(1.25 / 1e-5))) / 1;
        const mean = noises.reduce((a, b) => a + b, 0) / noises.length;
        const variance = noises.reduce((s, n) => s + (n - mean) * (n - mean), 0) / noises.length;
        expect(Math.abs(mean)).toBeLessThan(0.05);
        expect(Math.sqrt(variance)).toBeCloseTo(sigma, 1);
    });

    it("tightens privacy by increasing noise when epsilon shrinks", () => {
        const loose = [...mod.run({ releases: 1, epsilon: 4, delta: 1e-5, sensitivity: 0.2 })];
        const tight = [...mod.run({ releases: 1, epsilon: 0.5, delta: 1e-5, sensitivity: 0.2 })];
        const sigmaLoose = Number(loose[0]?.meta["sigma"]);
        const sigmaTight = Number(tight[0]?.meta["sigma"]);
        expect(sigmaTight).toBeGreaterThan(sigmaLoose);
        expect(sigmaTight / sigmaLoose).toBeCloseTo(8, 9);
        expect(sigmaLoose).toBeCloseTo((0.2 * Math.sqrt(2 * Math.log(1.25 / 1e-5))) / 4, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});

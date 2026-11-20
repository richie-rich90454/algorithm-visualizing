import { describe, expect, it } from "vitest";
import mod from "./algorithmic-cooling";
import type { VisualFrame } from "@/types";

function reference(computeBias: number, bathBias: number, rounds: number) {
    const p0 = (1 + computeBias) / 2;
    const q0 = (1 + bathBias) / 2;
    let dist: number[] = [];
    for (let i = 0; i < 8; i += 1) {
        const b0 = (i >> 2) & 1;
        const b1 = (i >> 1) & 1;
        const b2 = i & 1;
        dist.push((b0 === 0 ? p0 : 1 - p0) * (b1 === 0 ? q0 : 1 - q0) * (b2 === 0 ? q0 : 1 - q0));
    }
    for (let round = 0; round < rounds; round += 1) {
        const w = [q0 * q0, q0 * (1 - q0), (1 - q0) * q0, (1 - q0) * (1 - q0)];
        const next = new Array<number>(8).fill(0);
        for (let b0 = 0; b0 < 2; b0 += 1) {
            let mass = 0;
            for (let bath = 0; bath < 4; bath += 1) {
                mass += dist[b0 * 4 + bath] as number;
            }
            for (let bath = 0; bath < 4; bath += 1) {
                next[b0 * 4 + bath] = mass * (w[bath] as number);
            }
        }
        dist = next;
        const ranked = dist.map((probability, index) => ({ probability, index })).sort((a, b) => b.probability - a.probability || a.index - b.index);
        const sorted = new Array<number>(8).fill(0);
        ranked.forEach((entry, rank) => {
            sorted[rank] = entry.probability;
        });
        dist = sorted;
    }
    let bias = 0;
    dist.forEach((p, i) => {
        bias += ((i >> 2) & 1) === 0 ? p : -p;
    });
    return { dist, bias };
}

function biasOf(dist: number[]): number {
    let bias = 0;
    dist.forEach((p, i) => {
        bias += ((i >> 2) & 1) === 0 ? p : -p;
    });
    return bias;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const probs = frame.meta["probabilities"] as number[];
        expect(Array.isArray(probs)).toBe(true);
        expect(probs.length).toBe(8);
        expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        expect(probs.every((p) => p >= 0)).toBe(true);
        expect(Number(frame.meta["computeBias"])).toBeCloseTo(biasOf(probs), 10);
    });
}

describe("Algorithmic Cooling", () => {
    it("matches an independent eight-state reference", () => {
        for (const input of [
            { computeBias: 0.1, bathBias: 0.5, rounds: 4 },
            { computeBias: 0.2, bathBias: 0.8, rounds: 3 },
            { computeBias: 0, bathBias: 0.4, rounds: 5 },
        ]) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input.computeBias, input.bathBias, input.rounds);
            const final = frames[frames.length - 1]?.meta;
            const probs = final?.["probabilities"] as number[];
            probs.forEach((p, i) => expect(p).toBeCloseTo(expected.dist[i] as number, 10));
            expect(Number(final?.["computeBias"])).toBeCloseTo(expected.bias, 10);
        }
    });

    it("increases compute polarization across rounds", () => {
        const frames = [...mod.run({ computeBias: 0.1, bathBias: 0.5, rounds: 4 })];
        const biases = frames.map((f) => Number(f.meta["computeBias"]));
        for (let i = 1; i < biases.length; i += 1) {
            expect(biases[i] as number).toBeGreaterThanOrEqual((biases[i - 1] as number) - 1e-12);
        }
        expect(biases[biases.length - 1] as number).toBeGreaterThan(0.5);
        expect(biases[biases.length - 1] as number).toBeLessThanOrEqual(1);
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

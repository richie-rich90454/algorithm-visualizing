/** nucleus-sampling.test.ts - Independent nucleus reference, minimality, distribution properties, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { nucleusDistribution, sample, uniform } from "./nucleus-sampling";
import type { VisualFrame } from "@/types";

interface Input {
    logits: number[];
    p: number;
    seed: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

/** Independent reference for the top-p nucleus and its renormalized distribution. */
function reference(logits: number[], p: number) {
    const max = Math.max(...logits);
    const exps = logits.map((v) => Math.exp(v - max));
    const total = exps.reduce((a, b) => a + b, 0);
    const base = exps.map((v) => v / total);
    const order = base.map((_, i) => i).sort((a, b) => base[b]! - base[a]! || a - b);
    let cumulative = 0;
    let size = 0;
    for (const i of order) {
        cumulative += base[i]!;
        size += 1;
        if (cumulative >= p) break;
    }
    const kept = order.slice(0, size);
    const mass = kept.reduce((s, i) => s + base[i]!, 0);
    const probability = base.map((v, i) => (kept.includes(i) ? v / mass : 0));
    return { base, kept, probability, cumulative, size };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Nucleus sampling", () => {
    it("matches an independent reference on the default input", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.logits, input.p);
        const final = frames[frames.length - 1]?.meta;
        expect(new Set(final?.["kept"] as number[])).toEqual(new Set(expected.kept));
        const probability = final?.["probability"] as number[];
        probability.forEach((v, i) => expect(close(v, expected.probability[i]!)).toBe(true));
    });

    it("keeps the nucleus minimal and its probabilities normalized", () => {
        const logits = [2, 1.5, 0.8, 0.3, -0.5, -1.5, -2.5];
        const { kept, probability, base, size } = nucleusDistribution(logits, 0.9);
        expect(close(probability.reduce((a, b) => a + b, 0), 1)).toBe(true);
        const ranked = base.slice().sort((a, b) => b - a);
        const cutoff = ranked[size - 1]!;
        for (let i = 0; i < logits.length; i += 1) {
            if (!kept.has(i)) expect(base[i]!).toBeLessThanOrEqual(cutoff);
        }
        const withoutLast = ranked.slice(0, size - 1).reduce((a, b) => a + b, 0);
        expect(withoutLast).toBeLessThan(0.9);
    });

    it("expands the nucleus as p grows and always samples inside it", () => {
        const logits = [3, 2, 1, 0, -1, -2];
        const small = nucleusDistribution(logits, 0.5).size;
        const large = nucleusDistribution(logits, 0.99).size;
        expect(large).toBeGreaterThanOrEqual(small);
        const { probability, kept } = nucleusDistribution(logits, 0.9);
        for (let seed = 0; seed < 30; seed += 1) {
            expect(kept.has(sample(probability, seed))).toBe(true);
        }
        expect(uniform(3)).toBe(uniform(3));
    });

    it("matches the reference for p equal to one and terminates cleanly", () => {
        const input: Input = { logits: [1, 2, 3, 4], p: 1, seed: 11 };
        const expected = reference(input.logits, input.p);
        const generator = mod.run(input);
        let count = 0;
        let last: VisualFrame | undefined;
        for (const frame of generator) {
            last = frame;
            count += 1;
        }
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
        const probability = last?.meta["probability"] as number[];
        probability.forEach((v, i) => expect(close(v, expected.probability[i]!)).toBe(true));
        expect(expected.size).toBe(4);
    });
});

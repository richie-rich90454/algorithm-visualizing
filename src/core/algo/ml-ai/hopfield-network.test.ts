/** hopfield-network.test.ts - Hebbian weight properties, energy descent, pattern recall, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { energyOf, hebbianWeights } from "./hopfield-network";
import type { VisualFrame } from "@/types";

interface Input {
    patterns: number[][];
    probe: number[];
    steps: number;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBe(n);
    });
}

describe("Hopfield Network", () => {
    const input = mod.defaultInput as Input;

    it("builds symmetric zero-diagonal weights that fix every stored pattern", () => {
        const weights = hebbianWeights(input.patterns);
        const n = input.patterns[0]!.length;
        for (let i = 0; i < n; i += 1) {
            expect(weights[i]![i]!).toBe(0);
            for (let j = 0; j < n; j += 1) {
                expect(weights[i]![j]!).toBeCloseTo(weights[j]![i]!, 12);
            }
        }
        for (const pattern of input.patterns) {
            for (let i = 0; i < n; i += 1) {
                let field = 0;
                for (let j = 0; j < n; j += 1) {
                    field += weights[i]![j]! * pattern[j]!;
                }
                if (field !== 0) {
                    expect(Math.sign(field)).toBe(pattern[i]!);
                }
            }
        }
    });

    it("never increases energy and recalls a stored pattern", () => {
        const frames = [...mod.run(input)];
        expect(frames.length).toBe(input.steps + 2);
        checkFrames(frames, input.patterns[0]!.length);
        const energies = frames.map((f) => Number(f.meta["energy"]));
        for (let i = 1; i < energies.length; i += 1) {
            expect(energies[i]!).toBeLessThanOrEqual(energies[i - 1]! + 1e-9);
        }
        const final = frames.at(-1)!.meta["state"] as number[];
        const matches = input.patterns.some((p) => p.every((v, i) => v === final[i]));
        expect(matches).toBe(true);
        expect(energyOf(hebbianWeights(input.patterns), final)).toBeCloseTo(energies.at(-1)!, 9);
    });

    it("keeps every unit binary across the replay", () => {
        for (const frame of mod.run(input)) {
            for (const value of frame.meta["state"] as number[]) {
                expect(value === 1 || value === -1).toBe(true);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(input.steps + 2);
        expect(generator.next().done).toBe(true);
    });
});

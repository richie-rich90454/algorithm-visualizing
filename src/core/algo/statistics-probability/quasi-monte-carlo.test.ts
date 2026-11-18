/**
 * quasi-monte-carlo.test.ts - Independent digit-reversal check, numerical
 * accuracy, determinism, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./quasi-monte-carlo";
import type { VisualFrame } from "@/types";

/** Independent radical inverse by reversing the base-b digits directly. */
function radicalInverseByDigits(index: number, base: number): number {
    const digits: number[] = [];
    let n = index;
    while (n > 0) {
        digits.push(n % base);
        n = Math.floor(n / base);
    }
    let value = 0;
    let place = 1 / base;
    for (let i = 0; i < digits.length; i += 1) {
        value += (digits[i] ?? 0) * place;
        place /= base;
    }
    return value;
}

/** Independent reference estimate using the digit-reversal sequence. */
function referencePi(samples: number): number {
    let inside = 0;
    for (let i = 0; i < samples; i += 1) {
        const x = radicalInverseByDigits(i + 1, 2);
        const y = radicalInverseByDigits(i + 1, 3);
        if (x * x + y * y <= 1) inside += 1;
    }
    return (4 * inside) / samples;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node" && e.x >= 0 && e.x < 1 && e.y >= 0 && e.y < 1)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Quasi-Monte Carlo", () => {
    it("places every point where an independent digit reversal says it should", () => {
        const frames = [...mod.run({ samples: 30, showEvery: 10 })];
        checkFrames(frames);
        const nodes = frames[frames.length - 1]?.entities ?? [];
        expect(nodes.length).toBe(30);
        nodes.forEach((node, i) => {
            expect(node.x).toBeCloseTo(radicalInverseByDigits(i + 1, 2), 12);
            expect(node.y).toBeCloseTo(radicalInverseByDigits(i + 1, 3), 12);
        });
    });

    it("matches the reference estimate and lands close to pi", () => {
        const samples = 5000;
        const frames = [...mod.run({ samples, showEvery: 500 })];
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["estimate"])).toBeCloseTo(referencePi(samples), 12);
        expect(Math.abs(Number(last?.["estimate"]) - Math.PI)).toBeLessThan(0.02);
        expect(Number(last?.["error"])).toBeCloseTo(Math.abs(Number(last?.["estimate"]) - Math.PI), 12);
    });

    it("is deterministic and terminates cleanly", () => {
        const input = { samples: 100, showEvery: 25 };
        const a = [...mod.run(input)];
        const b = [...mod.run(input)];
        expect(a.map((f) => f.meta["estimate"])).toEqual(b.map((f) => f.meta["estimate"]));
        checkFrames(a);
        const generator = mod.run(input);
        [...generator];
        expect(generator.next().done).toBe(true);
    });
});

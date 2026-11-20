/** kzg-commitment.test.ts - Quotient identity, verification, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./kzg-commitment";
import type { VisualFrame } from "@/types";

const evalAt = (coefficients: number[], x: number): number =>
    coefficients.reduceRight((acc, coefficient) => acc * x + coefficient, 0);

const finalMeta = (frames: VisualFrame[]): VisualFrame["meta"] => (frames[frames.length - 1] as VisualFrame).meta;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("KZG commitment toy", () => {
    it("produces a quotient satisfying the polynomial factor identity", () => {
        const random = rng(777);
        for (let trial = 0; trial < 80; trial += 1) {
            const degree = 1 + Math.floor(random() * 4);
            const coefficients = Array.from({ length: degree + 1 }, () => Math.floor(random() * 9) - 4);
            const z = Math.floor(random() * 11) - 5;
            const frames = [...mod.run({ coefficients, z })];
            checkFrames(frames);
            const meta = finalMeta(frames);
            const q = meta["quotient"] as number[];
            const fz = meta["fAtZ"] as number;
            expect(fz).toBe(evalAt(coefficients, z));
            for (const x of [-3, -1, 0, 2, 7]) {
                expect(evalAt(coefficients, x) - fz + 0).toBe((x - z) * evalAt(q, x) + 0);
            }
            expect(meta["valid"]).toBe(true);
            expect(meta["tamperedValid"]).toBe(false);
        }
    });

    it("accepts the default claim and rejects an altered value", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const meta = finalMeta(frames);
        expect(meta["value"]).toBe(69);
        expect(meta["valid"]).toBe(true);
        expect(meta["tamperedValid"]).toBe(false);
        expect(meta["fakeValue"]).toBe(70);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});

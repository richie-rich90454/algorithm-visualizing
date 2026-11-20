/** bgw-protocol.test.ts - Reconstruction correctness, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./bgw-protocol";
import type { VisualFrame } from "@/types";

const finalMeta = (frames: VisualFrame[]): VisualFrame["meta"] => (frames[frames.length - 1] as VisualFrame).meta;

/** Lagrange interpolation at x=0 using modular inverses by brute force. */
function lagrangeAtZero(points: number[], p: number): number {
    const inv = (x: number): number => {
        for (let i = 1; i < p; i += 1) if ((x * i) % p === 1) return i;
        throw new Error(`no inverse for ${x}`);
    };
    let result = 0;
    for (let i = 0; i < points.length; i += 1) {
        let term = points[i] as number;
        for (let j = 0; j < points.length; j += 1) {
            if (i === j) continue;
            const xi = i + 1;
            const xj = j + 1;
            term = (term * ((p - xj) % p) * inv((xi - xj + p) % p)) % p;
        }
        result = (result + term) % p;
    }
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("BGW secure computation toy", () => {
    it("computes every sum and product correctly over a small field", () => {
        const p = 23;
        for (let a = 0; a < p; a += 1) {
            for (let b = 0; b < p; b += 1) {
                const frames = [...mod.run({ a, b, p, parties: 3 })];
                const meta = finalMeta(frames);
                expect(meta["sum"]).toBe((a + b) % p);
                expect(meta["product"]).toBe((a * b) % p);
                expect((meta["sumShares"] as number[]).length).toBe(3);
                expect((meta["reduced"] as number[]).length).toBe(3);
            }
        }
    });

    it("reconstructs the same answers with an independent Lagrange routine", () => {
        for (const [a, b, p, parties] of [[7, 4, 23, 3], [2, 9, 13, 4], [11, 12, 29, 5]] as const) {
            const frames = [...mod.run({ a, b, p, parties })];
            checkFrames(frames);
            const meta = finalMeta(frames);
            const sumShares = meta["sumShares"] as number[];
            const reduced = meta["reduced"] as number[];
            expect(lagrangeAtZero(sumShares, p)).toBe((a + b) % p);
            expect(lagrangeAtZero(reduced, p)).toBe((a * b) % p);
            expect(meta["sum"]).toBe((a + b) % p);
            expect(meta["product"]).toBe((a * b) % p);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});

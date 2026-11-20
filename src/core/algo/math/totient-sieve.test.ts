/** totient-sieve.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./totient-sieve";
import type { VisualFrame } from "@/types";

/** Independent brute-force phi(k) by counting coprime integers. */
function referencePhi(k: number): number {
    if (k === 1) {
        return 1;
    }
    let count = 0;
    for (let j = 1; j <= k; j += 1) {
        let a = j;
        let b = k;
        while (b !== 0) {
            const r = a % b;
            a = b;
            b = r;
        }
        if (a === 1) {
            count += 1;
        }
    }
    return count;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
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

describe("Totient Sieve", () => {
    it("matches brute-force phi for every k up to 300", () => {
        const frames = [...mod.run({ n: 300 })];
        checkFrames(frames);
        const phi = frames[frames.length - 1]?.meta["phi"] as number[];
        expect(phi.length).toBe(300);
        for (let k = 1; k <= 300; k += 1) {
            expect(phi[k - 1], `phi(${k})`).toBe(referencePhi(k));
        }
    });

    it("handles n = 1", () => {
        const frames = [...mod.run({ n: 1 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["phiN"]).toBe(1);
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

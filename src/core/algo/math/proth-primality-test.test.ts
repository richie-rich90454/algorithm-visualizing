/**
 * proth-primality-test.test.ts - Trial-division primality cross-check,
 * frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./proth-primality-test";
import type { VisualFrame } from "@/types";

function isPrime(n: number): boolean {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return false;
    return true;
}

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.meta["residues"])).toBe(true);
    });
}

describe("ProthPrimalityTest", () => {
    it("agrees with trial division for small Proth numbers", () => {
        for (let m = 1; m <= 5; m += 1) {
            for (let k = 1; k < 2 ** m; k += 2) {
                const n = k * 2 ** m + 1;
                if (n > 400) continue;
                const frames = [...mod.run({ k, m, maxBases: n - 1 })];
                checkFrames(frames);
                const verdict = frames[frames.length - 1]!.meta["verdict"];
                expect(verdict).toBe(isPrime(n) ? "prime" : "composite");
            }
        }
    });

    it("flags a non-Proth input as not applicable", () => {
        const frames = [...mod.run({ n: 27, maxBases: 26 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["verdict"]).toBe("not-applicable");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

/** apr-cl-primality-test.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./apr-cl-primality-test";
import type { VisualFrame } from "@/types";

function isPrimeReference(n: number): boolean {
    if (n < 2) {
        return false;
    }
    for (let d = 2; d * d <= n; d += 1) {
        if (n % d === 0) {
            return false;
        }
    }
    return true;
}

function verdictFor(n: number): string | undefined {
    const frames = [...mod.run({ n })];
    return frames[frames.length - 1]?.meta["verdict"] as string | undefined;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("APR-CL Lucas primality certificate", () => {
    it("never certifies a composite and certifies every prime in range", () => {
        for (let n = 2; n <= 300; n += 1) {
            const verdict = verdictFor(n);
            const prime = isPrimeReference(n);
            if (verdict === "prime" || verdict === "small") {
                expect(prime).toBe(true);
            }
            if (prime) {
                expect(verdict === "prime" || verdict === "small").toBe(true);
            }
        }
    });

    it("has well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) {
            frames.push(frame);
        }
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["verdict"]).toBe("prime");
        expect(generator.next().done).toBe(true);
    });
});

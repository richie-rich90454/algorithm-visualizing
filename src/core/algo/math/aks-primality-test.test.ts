import { describe, expect, it } from "vitest";
import mod from "./aks-primality-test";
import type { VisualFrame } from "@/types";

function reference(n: number): boolean {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return false;
    return true;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
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

describe("AKS Primality Test", () => {
    it("agrees with trial division on a wide range", () => {
        for (let n = 2; n <= 80; n += 1) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["prime"]).toBe(reference(n));
        }
    });

    it("classifies the default and larger examples", () => {
        for (const n of [101, 103, 91, 97, 121, 221, 127]) {
            const frames = [...mod.run({ n })];
            expect(frames[frames.length - 1]?.meta["prime"]).toBe(reference(n));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});

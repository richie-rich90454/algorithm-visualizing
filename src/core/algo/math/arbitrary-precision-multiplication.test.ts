import { describe, expect, it } from "vitest";
import mod from "./arbitrary-precision-multiplication";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function product(frames: VisualFrame[]): string {
    return String(frames[frames.length - 1]?.meta["product"]);
}

describe("Arbitrary-Precision Multiplication", () => {
    it("matches native big-integer multiplication on random operands", () => {
        let seed = 987654321;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const a = String(next());
            const b = String(next());
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            expect(product(frames)).toBe((BigInt(a) * BigInt(b)).toString());
        }
    });

    it("handles zeros and leading zeros", () => {
        expect(product([...mod.run({ a: "0000", b: "999" })])).toBe("0");
        expect(product([...mod.run({ a: "0", b: "0" })])).toBe("0");
        expect(product([...mod.run({ a: "00012", b: "003" })])).toBe("36");
    });

    it("solves the default input", () => {
        expect(product([...mod.run(mod.defaultInput)])).toBe("12193209765585");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

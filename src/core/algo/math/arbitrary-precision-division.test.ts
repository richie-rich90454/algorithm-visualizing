import { describe, expect, it } from "vitest";
import mod from "./arbitrary-precision-division";
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

describe("Arbitrary-Precision Division", () => {
    it("satisfies the division identity on random operands", () => {
        let seed = 1357911;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const dividend = String(next());
            const divisor = String((next() % 99999) + 1);
            const frames = [...mod.run({ dividend, divisor })];
            checkFrames(frames);
            const last = frames[frames.length - 1];
            const quotient = BigInt(String(last?.meta["quotient"]));
            const remainder = BigInt(String(last?.meta["remainder"]));
            expect(quotient * BigInt(divisor) + remainder).toBe(BigInt(dividend));
            expect(remainder).toBeLessThan(BigInt(divisor));
            expect(remainder).toBeGreaterThanOrEqual(0n);
        }
    });

    it("handles exact division, small dividends, and leading zeros", () => {
        const exact = [...mod.run({ dividend: "000144", divisor: "12" })];
        expect(String(exact[exact.length - 1]?.meta["quotient"])).toBe("12");
        expect(String(exact[exact.length - 1]?.meta["remainder"])).toBe("0");
        const small = [...mod.run({ dividend: "7", divisor: "10" })];
        expect(String(small[small.length - 1]?.meta["quotient"])).toBe("0");
        expect(String(small[small.length - 1]?.meta["remainder"])).toBe("7");
    });

    it("reports division by zero without throwing", () => {
        const frames = [...mod.run({ dividend: "10", divisor: "0" })];
        expect(frames).toHaveLength(1);
        expect(frames[0]?.meta["error"]).toBe("division by zero");
        expect(frames[0]?.entities.every((entity) => entity.state === "error")).toBe(true);
    });

    it("solves the default input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(String(frames[frames.length - 1]?.meta["quotient"])).toBe("142");
        expect(String(frames[frames.length - 1]?.meta["remainder"])).toBe("6");
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

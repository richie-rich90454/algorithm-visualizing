import { describe, expect, it } from "vitest";
import mod from "./arbitrary-precision-addition";
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

function result(frames: VisualFrame[]): string {
    return String(frames[frames.length - 1]?.meta["result"]);
}

describe("Arbitrary-Precision Addition", () => {
    it("matches native big-integer addition on random operands", () => {
        let seed = 123456789;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const a = String(next());
            const b = String(next());
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            const expected = (BigInt(a) + BigInt(b)).toString();
            expect(result(frames)).toBe(expected);
        }
    });

    it("propagates carries through long runs of nines and strips leading zeros", () => {
        expect(result([...mod.run({ a: "000999", b: "000001" })])).toBe("1000");
        expect(result([...mod.run({ a: "0", b: "0" })])).toBe("0");
        expect(result([...mod.run({ a: "100000000000000000000", b: "1" })])).toBe("100000000000000000001");
    });

    it("solves the default input", () => {
        expect(result([...mod.run(mod.defaultInput)])).toBe("100000000000000000000");
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

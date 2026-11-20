/**
 * shannon-fano-coding.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./shannon-fano-coding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], symbolCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(symbolCount);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent Shannon-Fano code builder using the same deterministic split rule. */
function referenceCodes(symbols: string[], frequencies: number[]): Map<string, string> {
    const items = symbols.map((symbol, order) => ({ symbol, frequency: frequencies[order] ?? 0, order }));
    const codes = new Map<string, string>();
    const recurse = (group: typeof items, prefix: string): void => {
        if (group.length === 0) {
            return;
        }
        if (group.length === 1) {
            codes.set(group[0]!.symbol, prefix || "0");
            return;
        }
        const sorted = [...group].sort((a, b) => b.frequency - a.frequency || a.order - b.order);
        const total = sorted.reduce((sum, item) => sum + item.frequency, 0);
        let left = 0;
        let split = 1;
        let best = Infinity;
        for (let i = 0; i < sorted.length - 1; i += 1) {
            left += sorted[i]!.frequency;
            const diff = Math.abs(2 * left - total);
            if (diff < best) {
                best = diff;
                split = i + 1;
            }
        }
        recurse(sorted.slice(0, split), prefix + "0");
        recurse(sorted.slice(split), prefix + "1");
    };
    recurse(items, "");
    return codes;
}

function isPrefixFree(codes: string[]): boolean {
    for (let i = 0; i < codes.length; i += 1) {
        for (let j = 0; j < codes.length; j += 1) {
            if (i !== j && (codes[j] as string).startsWith(codes[i] as string)) {
                return false;
            }
        }
    }
    return true;
}

describe("Shannon-Fano coding", () => {
    it("matches an independent code builder and round-trips", () => {
        const cases = [
            { symbols: ["a", "b", "c", "d"], frequencies: [45, 25, 20, 10] },
            { symbols: ["w", "x", "y", "z", "v"], frequencies: [8, 7, 6, 5, 4] },
            { symbols: ["p", "q", "r"], frequencies: [10, 1, 1] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.symbols.length);
            const final = frames[frames.length - 1]!.meta;
            expect(final["prefixFree"]).toBe(true);
            expect(final["roundTrip"]).toBe(true);
            const kraft = final["kraft"] as number;
            expect(kraft).toBeLessThanOrEqual(1 + 1e-9);
            const reference = referenceCodes(input.symbols, input.frequencies);
            for (const symbol of input.symbols) {
                const entity = frames[0]!.entities.find((e) => e.value === symbol);
                expect(entity?.metadata["code"]).toBe(reference.get(symbol));
            }
        }
    });

    it("is prefix-free and assigns shorter codes to frequent symbols", () => {
        const input = { symbols: ["a", "b", "c", "d"], frequencies: [45, 25, 20, 10] };
        const frames = [...mod.run(input)];
        const codes = frames[0]!.entities.map((e) => e.metadata["code"] as string);
        expect(isPrefixFree(codes)).toBe(true);
        const bySymbol = new Map(frames[0]!.entities.map((e) => [e.value as string, (e.metadata["code"] as string).length]));
        expect(bySymbol.get("a")).toBeLessThanOrEqual(bySymbol.get("d") as number);
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

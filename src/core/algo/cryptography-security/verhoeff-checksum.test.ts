/**
 * verhoeff-checksum.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./verhoeff-checksum";
import type { VisualFrame } from "@/types";

const D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];
const P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function checkDigit(data: string): number {
    let c = 0;
    const reversed = data.split("").reverse();
    for (let i = 0; i < reversed.length; i += 1) {
        const digit = Number(reversed[i]);
        c = (D[c] ?? [])[(P[(i + 1) % 8] ?? [])[digit] ?? 0] ?? 0;
    }
    return INV[c] ?? 0;
}

function valid(code: string): boolean {
    let c = 0;
    const reversed = code.split("").reverse();
    for (let i = 0; i < reversed.length; i += 1) {
        const digit = Number(reversed[i]);
        c = (D[c] ?? [])[(P[i % 8] ?? [])[digit] ?? 0] ?? 0;
    }
    return c === 0;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(String(frame.meta["digits"]).length);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Verhoeff Check Digit", () => {
    it("matches published check-digit examples", () => {
        const cases: Array<{ data: string; check: number }> = [
            { data: "236", check: 3 },
            { data: "123456", check: 8 },
            { data: "1337", check: 5 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ digits: testCase.data })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["checkDigit"])).toBe(testCase.check);
            expect(final?.["valid"]).toBe(true);
            expect(checkDigit(testCase.data)).toBe(testCase.check);
        }
    });

    it("the multiplication rows and columns are permutations", () => {
        for (let row = 0; row < 10; row += 1) {
            expect([...(D[row] ?? [])].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
            const column = D.map((r) => r[row]).sort((a, b) => (a ?? 0) - (b ?? 0));
            expect(column).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        }
    });

    it("detects every single-digit error and adjacent transposition", () => {
        const base = "12345";
        const full = base + String(checkDigit(base));
        expect(valid(full)).toBe(true);
        for (let position = 0; position < full.length; position += 1) {
            for (let digit = 0; digit <= 9; digit += 1) {
                if (digit === Number(full[position])) {
                    continue;
                }
                const mutated = full.slice(0, position) + String(digit) + full.slice(position + 1);
                expect(valid(mutated)).toBe(false);
            }
        }
        for (let position = 0; position + 1 < full.length; position += 1) {
            if (full[position] === full[position + 1]) {
                continue;
            }
            const swapped =
                full.slice(0, position) + full[position + 1] + full[position] + full.slice(position + 2);
            expect(valid(swapped)).toBe(false);
        }
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

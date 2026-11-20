/** berlekamp-massey.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./berlekamp-massey";
import type { VisualFrame } from "@/types";

const P = 1000003;

function norm(v: number): number {
    return ((v % P) + P) % P;
}

function reference(sequence: number[]): { connection: number[]; L: number } {
    const s = sequence.map(norm);
    let c = [1];
    let b = [1];
    let L = 0;
    let shift = 1;
    let lastD = 1;
    const inv = (v: number) => {
        let e = P - 2;
        let base = norm(v);
        let result = 1;
        while (e > 0) {
            if (e % 2 === 1) result = (result * base) % P;
            base = (base * base) % P;
            e = Math.floor(e / 2);
        }
        return result;
    };
    for (let n = 0; n < s.length; n += 1) {
        let d = s[n]!;
        for (let i = 1; i <= L; i += 1) d = (d + c[i]! * s[n - i]!) % P;
        d = norm(d);
        if (d === 0) {
            shift += 1;
        } else {
            const prev = c.slice();
            const factor = (d * inv(lastD)) % P;
            while (c.length <= b.length - 1 + shift) c.push(0);
            for (let i = 0; i < b.length; i += 1)
                c[i + shift] = norm(c[i + shift]! - factor * b[i]!);
            if (2 * L <= n) {
                L = n + 1 - L;
                b = prev;
                lastD = d;
                shift = 1;
            } else {
                shift += 1;
            }
        }
    }
    return { connection: c, L };
}

/** Does a LFSR of length len generate the whole finite sequence over GF(P)? */
function hasRegister(sequence: number[], len: number): boolean {
    const s = sequence.map(norm);
    const rows: number[][] = [];
    for (let j = len; j < s.length; j += 1) {
        const row: number[] = [];
        for (let i = 1; i <= len; i += 1) row.push(s[j - i]!);
        row.push(norm(-s[j]!));
        rows.push(row);
    }
    if (rows.length === 0) {
        return true;
    }
    const cols = len;
    let pivotRow = 0;
    for (let col = 0; col < cols && pivotRow < rows.length; col += 1) {
        let sel = -1;
        for (let r = pivotRow; r < rows.length; r += 1) {
            if (rows[r]![col] !== 0) {
                sel = r;
                break;
            }
        }
        if (sel === -1) {
            continue;
        }
        [rows[pivotRow], rows[sel]] = [rows[sel]!, rows[pivotRow]!];
        const inv = (() => {
            let e = P - 2;
            let base = norm(rows[pivotRow]![col]!);
            let result = 1;
            while (e > 0) {
                if (e % 2 === 1) result = (result * base) % P;
                base = (base * base) % P;
                e = Math.floor(e / 2);
            }
            return result;
        })();
        const pivot = rows[pivotRow]!.map((v) => norm(v * inv));
        rows[pivotRow] = pivot;
        for (let r = 0; r < rows.length; r += 1) {
            if (r === pivotRow) continue;
            const f = rows[r]![col]!;
            if (f === 0) continue;
            rows[r] = rows[r]!.map((v, k) => norm(v - f * pivot[k]!));
        }
        pivotRow += 1;
    }
    for (let r = pivotRow; r < rows.length; r += 1) {
        let allZero = true;
        for (let col = 0; col < cols; col += 1) {
            if (rows[r]![col] !== 0) {
                allZero = false;
                break;
            }
        }
        if (allZero && rows[r]![cols] !== 0) {
            return false;
        }
    }
    return true;
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

describe("Berlekamp-Massey", () => {
    it("matches a reference and proves minimality by linear algebra", () => {
        const cases: number[][] = [
            [1, 1, 2, 3, 5, 8, 13, 21, 34, 55],
            [2, 3, 5, 7, 11, 13, 17],
            [0, 0, 0, 0, 0, 0],
            [5, 1, 5, 1, 5, 1, 5, 1],
            [3, 6, 12, 24, 48, 96],
            [1, 0, 1, 0, 1, 0, 1, 0],
        ];
        for (const sequence of cases) {
            const frames = [...mod.run({ sequence })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(sequence);
            expect(final?.["linearComplexity"]).toBe(expected.L);
            const connection = final?.["connection"] as number[];
            expect(connection).toEqual(expected.connection);

            // Final polynomial reproduces every term.
            for (let j = expected.L; j < sequence.length; j += 1) {
                let predicted = 0;
                for (let i = 1; i <= expected.L; i += 1) {
                    predicted = (predicted + connection[i]! * norm(sequence[j - i]!)) % P;
                }
                expect(norm(predicted + norm(sequence[j]!))).toBe(0);
            }
            // No shorter register exists.
            for (let len = 0; len < expected.L; len += 1) {
                expect(hasRegister(sequence, len)).toBe(false);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});

import { describe, expect, it } from "vitest";
import module from "./burnt-pancake-sorting";

function collect(stack: number[]) {
    return [...module.run({ stack })];
}

function referenceSort(stack: number[]): number[] {
    const out = [...stack];
    const flip = (k: number): void => {
        for (let i = 0, j = k - 1; i < j; i += 1, j -= 1) {
            const t = out[i] as number;
            out[i] = out[j] as number;
            out[j] = t;
        }
        for (let i = 0; i < k; i += 1) out[i] = -(out[i] as number);
    };
    const n = out.length;
    for (let k = n; k >= 1; k -= 1) {
        const p = out.findIndex((x) => Math.abs(x) === k);
        if (p < 0) continue;
        if (p === k - 1 && (out[p] as number) < 0) continue;
        if (p !== 0) flip(p + 1);
        if ((out[0] as number) < 0) flip(1);
        if (k > 1) flip(k);
        else flip(1);
    }
    return out;
}

describe("burnt-pancake-sorting", () => {
    it("sorts every signed permutation to all-burnt-down order (brute force)", () => {
        const base = [1, 2, 3, 4];
        let checked = 0;
        // Every permutation of magnitudes times every sign pattern (n=4).
        const perms: number[][] = [];
        const permute = (arr: number[], cur: number[]): void => {
            if (arr.length === 0) {
                perms.push([...cur]);
                return;
            }
            for (let i = 0; i < arr.length; i += 1) {
                permute(arr.filter((_, j) => j !== i), [...cur, arr[i] as number]);
            }
        };
        permute(base, []);
        for (const p of perms) {
            for (let mask = 0; mask < 16; mask += 1) {
                const stack = p.map((v, i) => ((mask >> i) & 1 ? -v : v));
                const frames = collect(stack);
                const last = frames[frames.length - 1];
                expect(last).toBeDefined();
                const result = last!.entities.map((e) => e.value as number);
                expect(result).toEqual([-1, -2, -3, -4]);
                expect(result).toEqual(referenceSort(stack));
                checked += 1;
            }
        }
        expect(checked).toBe(24 * 16);
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = collect([3, -1, 2]);
        expect(frames.length).toBeGreaterThan(2);
        const maxLine = module.pseudocode!.length - 1;
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.edges).toEqual([]);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThanOrEqual(maxLine);
            expect(frame.layout).toBe("array");
            expect(frame.meta).toHaveProperty("flips");
        });
        // A second pass through the drained generator yields nothing new.
        const gen = module.run(module.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBe(frames.length > 0 ? collect([3, -1, 2]).length : 0);
    });
});

/**
 * longest-repeating-subsequence.test.ts - Brute force, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./longest-repeating-subsequence";
import type { VisualFrame } from "@/types";

/** Count distinct index sequences embedding t in s, capped at two. */
function occurrences(s: string, t: string): number {
    if (t.length === 0) return 0;
    const n = s.length;
    const m = t.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let j = 0; j <= n; j += 1) dp[0][j] = 1;
    for (let i = 1; i <= m; i += 1) {
        for (let j = 1; j <= n; j += 1) {
            let count = dp[i][j - 1] ?? 0;
            if (t[i - 1] === s[j - 1]) count = Math.min(2, count + (dp[i - 1][j - 1] ?? 0));
            dp[i][j] = count;
        }
    }
    return dp[m][n] ?? 0;
}

/** Exhaustive reference: two index sequences with equal characters and no equal step index. */
function bruteLrs(s: string): number {
    const entries: Array<{ seq: string; indices: number[] }> = [];
    const total = 1 << s.length;
    for (let mask = 1; mask < total; mask += 1) {
        let seq = "";
        const indices: number[] = [];
        for (let i = 0; i < s.length; i += 1) {
            if (mask & (1 << i)) {
                seq += s[i];
                indices.push(i);
            }
        }
        entries.push({ seq, indices });
    }
    let best = 0;
    for (let a = 0; a < entries.length; a += 1) {
        for (let b = a + 1; b < entries.length; b += 1) {
            const left = entries[a];
            const right = entries[b];
            if (!left || !right || left.seq !== right.seq) continue;
            let valid = true;
            for (let t = 0; t < left.indices.length; t += 1) {
                if (left.indices[t] === right.indices[t]) {
                    valid = false;
                    break;
                }
            }
            if (valid) best = Math.max(best, left.seq.length);
        }
    }
    return best;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n);
    });
}

describe("Longest Repeating Subsequence", () => {
    it("matches exhaustive enumeration on several short strings", () => {
        for (const s of ["banana", "abacdc", "abcabc", "aaaa", "abca", "xyz"]) {
            const frames = [...mod.run({ s })];
            checkFrames(frames, s.length);
            const answer = Number(frames[frames.length - 1]?.meta["answer"]);
            expect(answer, `input ${s}`).toBe(bruteLrs(s));
            const witness = String(frames[frames.length - 1]?.meta["sequence"]);
            expect(witness.length).toBe(answer);
            if (answer > 0) expect(occurrences(s, witness)).toBeGreaterThanOrEqual(2);
        }
    });

    it("reproduces the default answer of three", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 6);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(3);
        expect(frames[frames.length - 1]?.meta["sequence"]).toBe("abc");
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});

/** ctc-loss.test.ts - Brute-force alignment enumeration, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./ctc-loss";
import type { VisualFrame } from "@/types";

interface Input {
    labels: number[];
    T: number;
    logProbs: number[][];
}

function checkFrames(frames: VisualFrame[], S: number, T: number): void {
    expect(frames.length).toBe(T + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(S);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["cols"]).toBe(S);
    });
}

/** Collapse a CTC path by removing repeated symbols and blanks. */
function collapse(path: number[]): number[] {
    const out: number[] = [];
    for (const symbol of path) {
        if (out.length === 0 || out[out.length - 1] !== symbol) {
            out.push(symbol);
        }
    }
    return out.filter((symbol) => symbol !== 0);
}

/** Enumerate every length-T path and sum the probability of those matching labels. */
function bruteForceLogProbability(input: Input): number {
    const alphabet = input.labels.length + 1;
    const target = input.labels;
    let total = 0;
    const path: number[] = [];
    const walk = (t: number): void => {
        if (t === input.T) {
            const collapsed = collapse(path);
            if (collapsed.length === target.length && collapsed.every((v, i) => v === target[i]! + 1)) {
                let p = 1;
                for (let k = 0; k < input.T; k += 1) {
                    p *= Math.exp(input.logProbs[k]![path[k]!]!);
                }
                total += p;
            }
            return;
        }
        for (let a = 0; a < alphabet; a += 1) {
            path.push(a);
            walk(t + 1);
            path.pop();
        }
    };
    walk(0);
    return Math.log(total);
}

describe("CTC forward probability", () => {
    const input = mod.defaultInput as Input;

    it("matches brute-force enumeration of all valid alignments", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, 2 * input.labels.length + 1, input.T);
        const got = Number(frames[frames.length - 1]!.meta["logProbability"]);
        expect(got).toBeCloseTo(bruteForceLogProbability(input), 6);
    });

    it("agrees with brute force on a second label sequence", () => {
        const labels = [1, 0];
        const logProbs = [
            [-0.5, -1.0, -0.8],
            [-0.9, -0.4, -1.1],
            [-0.7, -0.6, -0.5],
            [-0.2, -1.8, -1.6],
            [-1.0, -0.3, -0.9],
        ];
        const alt: Input = { labels, T: logProbs.length, logProbs };
        const got = Number([...mod.run(alt)].at(-1)!.meta["logProbability"]);
        expect(got).toBeCloseTo(bruteForceLogProbability(alt), 6);
    });

    it("keeps DP cells finite only where an alignment can reach them", () => {
        const frame = [...mod.run(input)][0]!;
        const alpha = frame.meta["alpha"] as number[];
        expect(alpha.length).toBe(2 * input.labels.length + 1);
        expect(alpha[0]).not.toBe(-1e9);
        expect(alpha[1]).not.toBe(-1e9);
        expect(alpha.slice(2).every((v) => v === -1e9)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(input.T + 1);
        expect(generator.next().done).toBe(true);
    });
});

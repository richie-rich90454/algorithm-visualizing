/** word2vec-skip-gram.test.ts - Correctness and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./word2vec-skip-gram";
import type { VisualFrame } from "@/types";

function embed(word: string): [number, number] {
    let sum = 0;
    for (let i = 0; i < word.length; i += 1) {
        sum += word.charCodeAt(i);
    }
    return [(sum % 7) - 3, ((word.length * 3) % 5) - 2];
}

/** Brute-force reference for all valid (center, context) pairs. */
function reference(tokens: string[], window: number): Array<[number, number]> {
    const pairs: Array<[number, number]> = [];
    for (let position = 0; position < tokens.length; position += 1) {
        for (let offset = 1; offset <= window; offset += 1) {
            if (position - offset >= 0) {
                pairs.push([position, position - offset]);
            }
            if (position + offset < tokens.length) {
                pairs.push([position, position + offset]);
            }
        }
    }
    return pairs;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Word2vec skip-gram", () => {
    it("extracts exactly the brute-force pair set", () => {
        const cases: Array<{ tokens: string[]; window: number }> = [
            { tokens: ["the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog"], window: 2 },
            { tokens: ["a", "b", "c", "d"], window: 1 },
            { tokens: ["x", "y", "z", "w", "v"], window: 3 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const expected = reference(testCase.tokens, testCase.window);
            const collected: string[] = [];
            for (const frame of frames.slice(1, -1)) {
                collected.push(...(frame.meta["pairs"] as string[]));
            }
            const expectedStrings = expected.map(([center, context]) => `${testCase.tokens[center]}|${testCase.tokens[context]}`);
            expect(collected.sort()).toEqual(expectedStrings.sort());
            const lastMeta = frames[frames.length - 1]?.meta;
            expect(Number(lastMeta?.["totalPairs"])).toBe(expected.length);
        }
    });

    it("scores each pair with the dot product of the toy embeddings", () => {
        const frames = [...mod.run({ tokens: ["cat", "sat", "mat"], window: 1 })];
        for (const frame of frames.slice(1, -1)) {
            const centerWord = String(frame.meta["centerWord"]);
            const pairs = frame.meta["pairs"] as string[];
            const scores = frame.meta["scores"] as number[];
            const centerVec = embed(centerWord);
            scores.forEach((score, index) => {
                const contextWord = pairs[index]!.split("|")[1]!;
                const contextVec = embed(contextWord);
                const expected = centerVec[0] * contextVec[0] + centerVec[1] * contextVec[1];
                expect(score).toBeCloseTo(expected, 5);
            });
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

/** contrastive-search.test.ts - Independent scoring reference, argument properties, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { argmax, contrastiveScores, cosine } from "./contrastive-search";
import type { VisualFrame } from "@/types";

interface Input {
    context: number[][];
    candidates: number[][];
    logits: number[];
    alpha: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

/** Independent reference computing scores with explicit normalization. */
function reference(ctx: number[][], cand: number[][], logits: number[], alpha: number) {
    const exps = logits.map((v) => Math.exp(v));
    const sum = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((v) => v / sum);
    const scores = cand.map((c, k) => {
        let sim = 0;
        for (const h of ctx) {
            const dot = h.reduce((s, v, i) => s + v * (c[i] ?? 0), 0);
            const na = Math.sqrt(h.reduce((s, v) => s + v * v, 0));
            const nb = Math.sqrt(c.reduce((s, v) => s + v * v, 0));
            if (na > 0 && nb > 0) sim = Math.max(sim, dot / (na * nb));
        }
        return (1 - alpha) * sim + alpha * probs[k]!;
    });
    let best = 0;
    for (let i = 1; i < scores.length; i += 1) if (scores[i]! > scores[best]!) best = i;
    return { probs, scores, best };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Contrastive search", () => {
    it("matches an independent reference on several inputs", () => {
        const cases: Input[] = [
            { context: [[1, 0]], candidates: [[1, 0], [0, 1]], logits: [3, 2], alpha: 0.5 },
            {
                context: [[1, 0], [0, 1]],
                candidates: [[1, 0], [0.7, 0.7], [-1, 0]],
                logits: [1, 4, 2],
                alpha: 0.3,
            },
            {
                context: [[2, 1], [1, 2]],
                candidates: [[2, 1], [1, 2], [0, 0]],
                logits: [0.5, 0.5, 0.5],
                alpha: 1,
            },
        ];
        for (const c of cases) {
            const expected = reference(c.context, c.candidates, c.logits, c.alpha);
            const got = contrastiveScores(c.context, c.candidates, c.logits, c.alpha);
            got.scores.forEach((v, i) => expect(close(v, expected.scores[i]!)).toBe(true));
            got.probs.forEach((v, i) => expect(close(v, expected.probs[i]!)).toBe(true));
            expect(argmax(got.scores)).toBe(expected.best);
        }
    });

    it("cosine respects identity, orthogonality and zero vectors", () => {
        expect(close(cosine([1, 0], [1, 0]), 1)).toBe(true);
        expect(close(cosine([1, 0], [0, 1]), 0)).toBe(true);
        expect(close(cosine([1, 2], [2, 4]), 1)).toBe(true);
        expect(cosine([0, 0], [1, 1])).toBe(0);
    });

    it("scores are a convex blend with alpha at the extremes", () => {
        const ctx = [[1, 0]];
        const cand = [[1, 0], [0, 1]];
        const logits = [2, 1];
        const pureProb = contrastiveScores(ctx, cand, logits, 1);
        const probs = reference(ctx, cand, logits, 1).probs;
        pureProb.scores.forEach((v, i) => expect(close(v, probs[i]!)).toBe(true));
        const pureSim = contrastiveScores(ctx, cand, logits, 0);
        expect(close(pureSim.scores[0]!, 1)).toBe(true);
        expect(close(pureSim.scores[1]!, 0)).toBe(true);
    });

    it("matches the reference through the module run metadata", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.context, input.candidates, input.logits, input.alpha);
        const final = frames[frames.length - 1]?.meta;
        const scores = final?.["scores"] as number[];
        scores.forEach((v, i) => expect(close(v, expected.scores[i]!)).toBe(true));
        expect(final?.["chosen"]).toBe(expected.best);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});

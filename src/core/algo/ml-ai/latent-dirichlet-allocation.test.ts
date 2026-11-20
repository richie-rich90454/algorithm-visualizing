/** latent-dirichlet-allocation.test.ts - Count consistency from assignments, valid range, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./latent-dirichlet-allocation";
import type { VisualFrame } from "@/types";

interface Input {
    documents: number[][];
    topics: number;
    vocabSize: number;
    iterations: number;
}

function checkFrames(frames: VisualFrame[], D: number, K: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(D * K);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["D"]).toBe(D);
        expect(frame.meta["topics"]).toBe(K);
    });
}

describe("Latent Dirichlet Allocation", () => {
    const input = mod.defaultInput as Input;

    it("keeps count tables exactly consistent with the topic assignments", () => {
        const frames = [...mod.run(input)];
        expect(frames.length).toBe(input.iterations + 2);
        checkFrames(frames, input.documents.length, input.topics);
        const meta = frames.at(-1)!.meta;
        const assignments = meta["assignments"] as number[];
        const docTopic = meta["docTopicCounts"] as number[];
        const topicWord = meta["topicWordCounts"] as number[];
        const K = input.topics;
        const V = input.vocabSize;
        let index = 0;
        const recomputedDoc = Array(input.documents.length * K).fill(0) as number[];
        const recomputedWord = Array(K * V).fill(0) as number[];
        input.documents.forEach((doc, d) => {
            doc.forEach((word, token) => {
                const topic = assignments[index]!;
                expect(topic).toBeGreaterThanOrEqual(0);
                expect(topic).toBeLessThan(K);
                recomputedDoc[d * K + topic]! += 1;
                recomputedWord[topic * V + (word % V)]! += 1;
                expect(token).toBeGreaterThanOrEqual(0);
                index += 1;
            });
        });
        expect(index).toBe(assignments.length);
        expect(docTopic).toEqual(recomputedDoc);
        expect(topicWord).toEqual(recomputedWord);
    });

    it("maintains the invariants at every iteration, not only at the end", () => {
        for (const frame of mod.run(input)) {
            const assignments = frame.meta["assignments"] as number[];
            const docTopic = frame.meta["docTopicCounts"] as number[];
            const total = assignments.length;
            expect(docTopic.reduce((s, v) => s + v, 0)).toBe(total);
            assignments.forEach((t) => {
                expect(t).toBeGreaterThanOrEqual(0);
                expect(t).toBeLessThan(input.topics);
            });
        }
    });

    it("report a finite assignment likelihood", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        expect(Number.isFinite(Number(meta["logLikelihood"]))).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(input.iterations + 2);
        expect(generator.next().done).toBe(true);
    });
});

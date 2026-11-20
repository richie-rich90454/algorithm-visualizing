/**
 * contrastive-loss-ntxent.test.ts - Independent loss reference, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./contrastive-loss-ntxent";
import type { VisualFrame } from "@/types";

type Vector = number[];
interface Input {
    embeddings: Vector[];
    temperature: number;
}

function cos(a: Vector, b: Vector): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let d = 0; d < a.length; d += 1) {
        dot += a[d]! * b[d]!;
        na += a[d]! ** 2;
        nb += b[d]! ** 2;
    }
    return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Straightforward NT-Xent oracle without the max-shift trick. */
function reference(embeddings: Vector[], tau: number): number {
    const m = embeddings.length;
    let total = 0;
    for (let i = 0; i < m; i += 1) {
        const pair = i % 2 === 0 ? i + 1 : i - 1;
        let denom = 0;
        for (let j = 0; j < m; j += 1) {
            if (j !== i) {
                denom += Math.exp(cos(embeddings[i]!, embeddings[j]!) / tau);
            }
        }
        total += -Math.log(Math.exp(cos(embeddings[i]!, embeddings[pair]!) / tau) / denom);
    }
    return total / m;
}

function checkFrames(frames: VisualFrame[], m: number): void {
    expect(frames.length).toBe(m + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(m * m);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => (e.metadata["row"] as number) >= 0 && (e.metadata["col"] as number) >= 0)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("NTXentLoss", () => {
    it("matches an independent oracle across temperatures and batch sizes", () => {
        const cases: Input[] = [
            { embeddings: [[1, 0], [0.9, 0.1], [-1, 0], [-0.9, -0.1]], temperature: 0.5 },
            { embeddings: [[1, 0, 0], [1, 0.1, 0], [0, 1, 0], [0, 0.9, 0.1], [-1, 0, 0], [-0.9, 0, 0.2]], temperature: 1 },
            { embeddings: [[2, 1], [2.1, 1.1], [-2, -1], [-1.9, -1.2]], temperature: 0.1 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.embeddings.length);
            const finalMeta = frames[frames.length - 1]?.meta ?? {};
            expect(Number(finalMeta["loss"])).toBeCloseTo(reference(input.embeddings, input.temperature), 6);
        }
    });

    it("gives a lower loss when positive pairs are closer", () => {
        const tight: Input = { embeddings: [[1, 0], [1, 0.01], [-1, 0], [-1, 0.01]], temperature: 0.5 };
        const loose: Input = { embeddings: [[1, 0], [0.2, 0.98], [-1, 0], [-0.2, 0.98]], temperature: 0.5 };
        const lossOf = (input: Input): number => {
            const frames = [...mod.run(input)];
            return Number(frames[frames.length - 1]?.meta["loss"]);
        };
        expect(lossOf(tight)).toBeLessThan(lossOf(loose));
    });

    it("reports one anchor loss per view", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const anchorLosses = frames[frames.length - 1]?.meta["anchorLosses"] as number[];
        expect(anchorLosses).toHaveLength((mod.defaultInput as Input).embeddings.length);
        expect(anchorLosses.every((v) => Number.isFinite(v))).toBe(true);
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

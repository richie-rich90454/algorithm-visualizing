/**
 * law-of-total-probability.test.ts - Direct-mass cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./law-of-total-probability";
import type { VisualFrame } from "@/types";

interface Outcome {
    group: string;
    inA: boolean;
    mass: number;
}

/** Independent direct computation of P(A) and of each group mass. */
function reference(outcomes: Outcome[]) {
    const total = outcomes.reduce((sum, o) => sum + o.mass, 0) || 1;
    let pA = 0;
    const byGroup = new Map<string, { mass: number; joint: number }>();
    for (const o of outcomes) {
        const entry = byGroup.get(o.group) ?? { mass: 0, joint: 0 };
        entry.mass += o.mass;
        if (o.inA) {
            entry.joint += o.mass;
            pA += o.mass;
        }
        byGroup.set(o.group, entry);
    }
    for (const entry of byGroup.values()) {
        entry.mass /= total;
        entry.joint /= total;
    }
    return { pA: pA / total, byGroup };
}

function checkFrames(frames: VisualFrame[], expectedGroups: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedGroups);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("LawOfTotalProbability", () => {
    it("matches a direct mass sum on the default input", () => {
        const input = mod.defaultInput as { outcomes: Outcome[] };
        const frames = [...mod.run(input)];
        const groups = new Set(input.outcomes.map((o) => o.group));
        checkFrames(frames, groups.size);
        const expected = reference(input.outcomes);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["pA"])).toBeCloseTo(expected.pA, 10);

        for (const [group, entry] of expected.byGroup) {
            const bar = frames[0]?.entities.find((e) => e.id === `bar-${group}`);
            expect(bar).toBeDefined();
            expect(Number(bar?.metadata["pB"])).toBeCloseTo(entry.mass, 10);
            expect(Number(bar?.metadata["pAB"])).toBeCloseTo(entry.joint, 10);
        }
    });

    it("matches direct sums on random partitions", () => {
        let seed = 7;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const groupCount = 2 + Math.floor(rand() * 4);
            const outcomes: Outcome[] = [];
            for (let g = 0; g < groupCount; g += 1) {
                const count = 1 + Math.floor(rand() * 3);
                for (let c = 0; c < count; c += 1) {
                    outcomes.push({
                        group: `G${g}`,
                        inA: rand() < 0.5,
                        mass: 0.05 + rand(),
                    });
                }
            }
            const frames = [...mod.run({ outcomes })];
            const expected = reference(outcomes);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(Number(finalMeta?.["pA"])).toBeCloseTo(expected.pA, 10);
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

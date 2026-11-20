/** hkdf.test.ts - Correctness and frame checks for the toy keyed hash. */

import { describe, expect, it } from "vitest";
import mod from "./hkdf";
import type { VisualFrame } from "@/types";

interface Input {
    ikm: number[];
    salt: number;
    info: number;
    length: number;
}

function prf(key: number, data: number[]): number {
    let hash = key >>> 0;
    for (const value of data) {
        hash = Math.imul(hash ^ (value >>> 0), 16777619) >>> 0;
    }
    return hash >>> 0;
}

/** Independent extract-and-expand reference. */
function reference(input: Input) {
    const prk = prf(input.salt >>> 0, input.ikm.map((v) => v >>> 0));
    const outputs: number[] = [];
    for (let i = 1; i <= input.length; i += 1) {
        const previous = i === 1 ? [] : [outputs[i - 2]!];
        outputs.push(prf(prk, [...previous, input.info >>> 0, i]));
    }
    return { prk, outputs };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(typeof frame.meta["rows"]).toBe("number");
        expect(typeof frame.meta["cols"]).toBe("number");
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("HKDF toy keyed hash", () => {
    it("matches an independent extract-and-expand reference", () => {
        const cases: Input[] = [
            { ikm: [1, 2, 3, 4], salt: 0xa0, info: 0x11, length: 3 },
            { ikm: [9, 8, 7], salt: 42, info: 5, length: 1 },
            { ikm: [255, 0, 17, 33, 200], salt: 0, info: 99, length: 5 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["prk"]).toBe(expected.prk);
            expect(finalMeta?.["okm"]).toEqual(expected.outputs);
        }
    });

    it("is deterministic and depends on the salt and previous block", () => {
        const input: Input = { ikm: [3, 1, 4], salt: 11, info: 2, length: 3 };
        const first = [...mod.run(input)];
        const second = [...mod.run(input)];
        expect(first[first.length - 1]?.meta["okm"]).toEqual(second[second.length - 1]?.meta["okm"]);
        const changedSalt = [...mod.run({ ...input, salt: 12 })];
        expect(changedSalt[changedSalt.length - 1]?.meta["prk"]).not.toBe(first[first.length - 1]?.meta["prk"]);
        const outputs = first[first.length - 1]?.meta["okm"] as number[];
        expect(reference(input).outputs[2]).toBe(prf(reference(input).prk, [outputs[1]!, input.info, 3]));
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

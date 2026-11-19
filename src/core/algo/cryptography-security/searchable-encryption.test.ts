/** searchable-encryption.test.ts - Encrypted search checked against a plain-text scan. */

import { describe, expect, it } from "vitest";
import mod, { buildIndex, decryptId, encryptId, search, tokenize, trapdoor } from "./searchable-encryption";
import type { VisualFrame } from "@/types";

function bruteSearch(documents: string[], keyword: string): number[] {
    return documents
        .map((document, index) => (tokenize(document).includes(keyword.toLowerCase()) ? index : -1))
        .filter((index) => index >= 0);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Searchable symmetric encryption toy model", () => {
    it("tokenizes and derives stable trapdoors", () => {
        expect(tokenize("The Quick, brown fox!")).toEqual(["the", "quick", "brown", "fox"]);
        expect(trapdoor(42, "brown")).toBe(trapdoor(42, "brown"));
        expect(trapdoor(42, "brown")).not.toBe(trapdoor(43, "brown"));
        expect(trapdoor(42, "brown")).not.toBe(trapdoor(42, "fox"));
    });

    it("inverts identifier encryption for many keys and identifiers", () => {
        for (const key of [1, 42, 777]) {
            for (const keyword of ["alpha", "beta"]) {
                const trap = trapdoor(key, keyword);
                for (let id = 0; id < 50; id += 1) {
                    expect(decryptId(trap, encryptId(trap, id))).toBe(id);
                }
            }
        }
    });

    it("returns exactly the documents found by a brute-force scan", () => {
        const documents = ["the quick brown fox", "brown bears sleep", "quick results arrive", "alpha beta alpha"];
        const index = buildIndex(documents, 42);
        for (const keyword of ["brown", "quick", "fox", "alpha", "missing"]) {
            expect(search(index, 42, keyword)).toEqual(bruteSearch(documents, keyword));
        }
        const wrongKeyIndex = buildIndex(documents, 43);
        expect(search(wrongKeyIndex, 42, "brown")).toEqual([]);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["results"]).toEqual([0, 1]);
        expect(generator.next().done).toBe(true);
    });
});

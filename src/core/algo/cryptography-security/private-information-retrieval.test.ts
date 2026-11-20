/**
 * private-information-retrieval.test.ts - Exhaustive retrieval property, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./private-information-retrieval";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], cols: number): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cols * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(cols);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("PrivateInformationRetrieval", () => {
    it("retrieves every item for many random subsets (exhaustive index sweep)", () => {
        const database = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0];
        for (let seed = 0; seed < 12; seed += 1) {
            for (let index = 0; index < database.length; index += 1) {
                const frames = [...mod.run({ database, index, seed })];
                checkFrames(frames, database.length);
                const meta = frames[frames.length - 1]?.meta;
                const query1 = meta?.["query1"] as number[];
                const query2 = meta?.["query2"] as number[];
                expect(query2).toEqual(
                    query1.map((value, position) => (position === index ? 1 - value : value)),
                );
                const answer = (query: number[]) =>
                    database.reduce(
                        (xor, bit, position) => (query[position] === 1 ? xor ^ bit : xor),
                        0,
                    );
                expect(meta?.["answer1"]).toBe(answer(query1));
                expect(meta?.["answer2"]).toBe(answer(query2));
                expect(meta?.["result"]).toBe(database[index]);
            }
        }
    });

    it("keeps the first query independent of the requested index", () => {
        const database = [1, 0, 1, 1, 0, 0, 1, 0];
        const seed = 5;
        const queries = database.map((_bit, index) => {
            const frames = [...mod.run({ database, index, seed })];
            checkFrames(frames, database.length);
            return frames[0]?.meta["query1"];
        });
        for (const query of queries) {
            expect(query).toEqual(queries[0]);
        }
    });

    it("handles a single-element database", () => {
        const frames = [...mod.run({ database: [1], index: 0, seed: 2 })];
        checkFrames(frames, 1);
        expect(frames[frames.length - 1]?.meta["result"]).toBe(1);
        const zeroFrames = [...mod.run({ database: [0], index: 0, seed: 2 })];
        expect(zeroFrames[zeroFrames.length - 1]?.meta["result"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});

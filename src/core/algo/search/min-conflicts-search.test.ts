/**
 * min-conflicts-search.test.ts – Minimum viable test for Min-Conflicts Search.
 */

import { describe, expect, it } from "vitest";
import minConflictsSearch from "./min-conflicts-search";

describe("MinConflictsSearch", () => {
    it("yields at least one frame", () => {
        const generator = minConflictsSearch.run(minConflictsSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = minConflictsSearch.run(minConflictsSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});

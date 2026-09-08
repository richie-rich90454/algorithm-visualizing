import { describe, expect, it } from "vitest";
import treeSteinerSubtree from "./tree-steiner-subtree";

describe("TreeSteinerSubtree", () => {
    it("yields at least one frame", () => {
        const generator = treeSteinerSubtree.run(treeSteinerSubtree.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = treeSteinerSubtree.run(treeSteinerSubtree.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});

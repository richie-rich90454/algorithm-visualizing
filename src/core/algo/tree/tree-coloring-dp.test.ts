import { describe, expect, it } from "vitest";
import treeColoringDp from "./tree-coloring-dp";

describe("TreeColoringDp", () => {
    it("yields at least one frame", () => {
        const generator = treeColoringDp.run(treeColoringDp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = treeColoringDp.run(treeColoringDp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});

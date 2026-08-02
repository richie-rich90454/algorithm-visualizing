import { describe, it, expect } from "vitest";
import { applyTreeLayout } from "@/visualization/layout/TreeLayout";
import dsuModule from "@/core/algo/ds/dsu";

describe("TreeLayout", () => {
    it("spreads a forest of sibling roots without overlap", () => {
        // dsu's first frame is six isolated roots (parentId "root"); the
        // layout must place them side by side, not stack them on one spot.
        const frames = [...dsuModule.run(dsuModule.defaultInput)];
        const frame = frames[0];
        applyTreeLayout(frame, 694, 604);

        expect(frame.entities.length).toBeGreaterThan(1);
        const xs = frame.entities.map((e) => Math.round(e.x));
        for (let i = 1; i < xs.length; i += 1) {
            expect(Math.abs(xs[i] - xs[i - 1])).toBeGreaterThanOrEqual(40);
        }
    });
});

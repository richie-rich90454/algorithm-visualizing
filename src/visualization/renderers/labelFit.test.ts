import { describe, it, expect } from "vitest";
import { fitLabel } from "@/visualization/renderers/LabelRenderer";

/** Minimal context stub: measureText counts 6 logical px per character. */
const ctx = {
    measureText(text: string): { width: number } {
        return { width: text.length * 6 };
    },
} as unknown as CanvasRenderingContext2D;

describe("fitLabel", () => {
    it("keeps a label that already fits unchanged", () => {
        expect(fitLabel(ctx, "00=0.354", 60)).toBe("00=0.354");
    });

    it("shortens an overlong label to the longest prefix plus an ellipsis", () => {
        expect(fitLabel(ctx, "00=0.354", 30)).toBe("00=0…");
    });

    it("falls back to a leading character plus an ellipsis as the minimum", () => {
        expect(fitLabel(ctx, "abcdef", 12)).toBe("a…");
    });

    it("omits the label when not even the minimum fits", () => {
        expect(fitLabel(ctx, "12345", 10)).toBe("");
    });

    it("passes empty text through", () => {
        expect(fitLabel(ctx, "", 40)).toBe("");
    });
});

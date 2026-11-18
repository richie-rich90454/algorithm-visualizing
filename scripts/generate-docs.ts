/**
 * generate-docs.ts - Generate the VitePress source site from the registry.
 *
 * Run with: bun scripts/generate-docs.ts
 *
 * Source of truth is src/core/manifest.ts: every page, count, link, and sidebar
 * entry is derived from MANIFEST. Category labels come from the shared map in
 * src/composables/categories.ts. The only static data here is presentation
 * (copy, config shape, and CSS).
 */

import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { LOADERS, MANIFEST, type AlgorithmMeta } from "../src/core/manifest.ts";
import { CATEGORY_LABELS } from "../src/composables/categories.ts";
import type { AlgorithmEducation } from "../src/types/algo.ts";

const SITE_NAME = "Algorithm Visualizer";
const SITE_ORIGIN = "https://richie-rich90454.github.io";
const REPO_BASE = "/algorithm-visualizing";
const DOCS_BASE = `${REPO_BASE}/docs/`;
const DOCS_BASE_URL = `${SITE_ORIGIN}${DOCS_BASE}`;
const VISUALIZER_URL = `${SITE_ORIGIN}${REPO_BASE}/`;
const GITHUB_URL = "https://github.com/richie-rich90454/algorithm-visualizing";
const OG_IMAGE_URL = `${DOCS_BASE_URL}og-image.png`;
const DEEP_LINK_PARAM = "algo";

const ROOT = path.resolve(import.meta.dir, "..");
const DOCS_DIR = path.join(ROOT, "docs");
const LOAD_CONCURRENCY = 32;

/** Canonical category order comes from the app's shared label map. */
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

type HeadTag = [string, Record<string, string>, string?];

interface EducationSection {
    title: string;
    key: keyof AlgorithmEducation;
    kind: "text" | "list";
}

const EDUCATION_SECTIONS: EducationSection[] = [
    { title: "Intuition", key: "intuition", kind: "text" },
    { title: "Invariants", key: "invariants", kind: "list" },
    { title: "Correctness", key: "correctness", kind: "text" },
    { title: "Complexity Rationale", key: "complexityRationale", kind: "text" },
    { title: "Uses", key: "uses", kind: "list" },
    { title: "References", key: "references", kind: "list" },
    { title: "Worked Example", key: "workedExample", kind: "text" },
];

/* ------------------------------------------------------------------ */
/* Presentation assets                                                 */
/* ------------------------------------------------------------------ */

const THEME_INDEX = `import DefaultTheme from "vitepress/theme";

import "./fonts.css";
import "./style.css";

export default {
    extends: DefaultTheme,
};
`;

const FONTS_CSS = `@font-face {
    font-family: "Noto Sans";
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url("/fonts/notosans-regular.woff2") format("woff2");
}

@font-face {
    font-family: "Noto Sans";
    font-style: normal;
    font-weight: 500;
    font-display: swap;
    src: url("/fonts/notosans-500.woff2") format("woff2");
}

@font-face {
    font-family: "Noto Sans";
    font-style: normal;
    font-weight: 600;
    font-display: swap;
    src: url("/fonts/notosans-600.woff2") format("woff2");
}
`;

/**
 * Design tokens mirror src/styles/global.css. They are defined locally rather
 * than imported because the app stylesheet sets `overflow: hidden` and a
 * full-viewport #app layout that would break VitePress.
 */
const STYLE_CSS = `/* App design tokens (flat, no gradients or shadows). */
:root {
    --color-bg-canvas: #ffffff;
    --color-bg-sidebar: #f9fafb;
    --color-bg-controls: #ffffff;
    --color-bg-description: #f9fafb;
    --color-border-panel: #e5e7eb;
    --color-text-primary: #111827;
    --color-text-secondary: #6b7280;

    --state-idle-bg: #f3f4f6;
    --state-idle-border: #d1d5db;
    --state-active-bg: #3b82f6;
    --state-active-border: #2563eb;
    --state-active-text: #ffffff;
    --state-sorted-bg: #10b981;
    --state-comparing-bg: #fcd34d;
}

.dark {
    --color-bg-canvas: #0f172a;
    --color-bg-sidebar: #111827;
    --color-bg-controls: #1f2937;
    --color-bg-description: #111827;
    --color-border-panel: #374151;
    --color-text-primary: #f3f4f6;
    --color-text-secondary: #9ca3af;

    --state-idle-bg: #374151;
    --state-idle-border: #6b7280;
    --state-active-bg: #60a5fa;
    --state-active-border: #93c5fd;
    --state-active-text: #0f172a;
    --state-sorted-bg: #10b981;
    --state-comparing-bg: #f59e0b;
}

/* Map VitePress functional variables onto the app tokens. */
:root {
    --vp-c-bg: var(--color-bg-canvas);
    --vp-c-bg-alt: var(--color-bg-sidebar);
    --vp-c-bg-elv: var(--color-bg-controls);
    --vp-c-bg-soft: var(--color-bg-description);

    --vp-c-border: var(--color-border-panel);
    --vp-c-divider: var(--color-border-panel);
    --vp-c-gutter: var(--color-border-panel);

    --vp-c-text-1: var(--color-text-primary);
    --vp-c-text-2: var(--color-text-secondary);
    --vp-c-text-3: var(--color-text-secondary);

    --vp-c-brand-1: var(--state-active-border);
    --vp-c-brand-2: var(--state-active-bg);
    --vp-c-brand-3: var(--state-active-border);
    --vp-c-brand: var(--state-active-border);
    --vp-c-brand-soft: var(--state-idle-bg);

    --vp-c-tip-1: var(--state-sorted-bg);
    --vp-c-tip-soft: var(--state-idle-bg);
    --vp-c-warning-1: var(--state-comparing-bg);
    --vp-c-warning-soft: var(--state-idle-bg);

    --vp-font-family-base: "Noto Sans", sans-serif;
    --vp-font-family-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

    --vp-code-bg: var(--state-idle-bg);
    --vp-code-color: var(--state-active-border);
    --vp-code-link-color: var(--state-active-border);
    --vp-code-block-color: var(--color-text-primary);
    --vp-code-block-bg: var(--color-bg-description);
    --vp-code-block-divider-color: var(--color-border-panel);
    --vp-code-line-number-color: var(--color-text-secondary);
    --vp-code-copy-code-bg: var(--color-bg-sidebar);
    --vp-code-copy-code-hover-bg: var(--color-bg-canvas);

    --vp-sidebar-bg-color: var(--color-bg-sidebar);
    --vp-nav-bg-color: var(--color-bg-canvas);
    --vp-local-search-bg: var(--color-bg-canvas);
    --vp-local-search-result-bg: var(--color-bg-canvas);
    --vp-local-search-result-selected-bg: var(--color-bg-sidebar);
    --vp-local-search-result-selected-border: var(--state-active-border);

    --vp-shadow-1: none;
    --vp-shadow-2: none;
    --vp-shadow-3: none;
    --vp-shadow-4: none;
    --vp-shadow-5: none;

    --vp-layout-max-width: 1280px;

    --vp-c-default-soft: var(--state-idle-bg);
    --vp-c-note-soft: var(--state-idle-bg);
    --vp-c-success-soft: var(--state-idle-bg);
    --vp-c-important-soft: var(--state-idle-bg);
    --vp-c-danger-soft: var(--state-idle-bg);
    --vp-c-caution-soft: var(--state-idle-bg);
}

html {
    font-size: 14px;
}

/* Flat surfaces: 1px borders, 4px radii, no shadows or gradients. */
.vp-doc pre,
.vp-doc code,
.vp-doc table,
.custom-block,
.VPButton,
.VPSidebarItem,
.search-dialog,
.VPBadge,
.vp-doc a.cta {
    border-radius: 4px;
}

.vp-doc {
    line-height: 1.6;
}

.vp-doc table {
    border: 1px solid var(--color-border-panel);
    border-collapse: collapse;
}

.vp-doc th,
.vp-doc td {
    border: 1px solid var(--color-border-panel);
    padding: 8px 12px;
}

.vp-doc th {
    background: var(--color-bg-sidebar);
    color: var(--color-text-primary);
    font-weight: 600;
}

.vp-doc a {
    color: var(--state-active-border);
    text-decoration: none;
}

.vp-doc a:hover {
    text-decoration: underline;
}

.vp-doc a.cta {
    display: inline-block;
    padding: 8px 16px;
    border: 1px solid var(--state-active-border);
    font-weight: 500;
}

.vp-doc a.cta:hover {
    background: var(--color-bg-sidebar);
    text-decoration: none;
}

.vp-doc blockquote {
    border-left: 3px solid var(--state-active-border);
    background: var(--color-bg-description);
    padding: 8px 16px;
}
`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Escape markdown syntax in prose and link labels. */
function mdText(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\*/g, "\\*")
        .replace(/_/g, "\\_")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/** Escape JSON-LD for a raw-text <script> block without breaking the JSON. */
function jsonLd(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
}

function truncate(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`;
}

function categoryLabel(id: string): string {
    return (
        CATEGORY_LABELS[id as keyof typeof CATEGORY_LABELS] ??
        id.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
    );
}

function groupByCategory(items: AlgorithmMeta[]): Map<string, AlgorithmMeta[]> {
    const groups = new Map<string, AlgorithmMeta[]>();
    for (const item of items) {
        const list = groups.get(item.category) ?? [];
        list.push(item);
        groups.set(item.category, list);
    }
    for (const list of groups.values()) {
        list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
}

function orderedCategories(groups: Map<string, AlgorithmMeta[]>): [string, AlgorithmMeta[]][] {
    const ids = [...groups.keys()];
    ids.sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a);
        const ib = CATEGORY_ORDER.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
    return ids.map((id) => [id, groups.get(id) as AlgorithmMeta[]]);
}

function sectionHasContent(education: AlgorithmEducation, section: EducationSection): boolean {
    const value = education[section.key];
    return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.length > 0;
}

/** Keep only typed, non-empty values so partial education objects render cleanly. */
function normalizeEducation(value: unknown): AlgorithmEducation | null {
    if (!value || typeof value !== "object") return null;
    const raw = value as Record<string, unknown>;
    const text = (key: string): string => {
        const candidate = raw[key];
        return typeof candidate === "string" ? candidate.trim() : "";
    };
    const list = (key: string): string[] => {
        const candidate = raw[key];
        return Array.isArray(candidate)
            ? candidate.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            : [];
    };
    const education: AlgorithmEducation = {
        intuition: text("intuition"),
        invariants: list("invariants"),
        correctness: text("correctness"),
        complexityRationale: text("complexityRationale"),
        uses: list("uses"),
        references: list("references"),
        workedExample: text("workedExample"),
    };
    return EDUCATION_SECTIONS.some((section) => sectionHasContent(education, section)) ? education : null;
}

function fence(lang: string, lines: string[]): string {
    return `~~~~${lang}\n${lines.join("\n")}\n~~~~`;
}

function frontmatter(title: string, description: string, head: HeadTag[]): string {
    return (
        `---\n` +
        `title: ${JSON.stringify(title)}\n` +
        `description: ${JSON.stringify(description)}\n` +
        `head: ${JSON.stringify(head)}\n` +
        `---\n\n`
    );
}

function educationArticleBody(education: AlgorithmEducation): string {
    const parts: string[] = [];
    for (const section of EDUCATION_SECTIONS) {
        if (!sectionHasContent(education, section)) continue;
        const value = education[section.key];
        parts.push(`${section.title}: ${Array.isArray(value) ? value.join("; ") : value}`);
    }
    return parts.join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Page renderers                                                      */
/* ------------------------------------------------------------------ */

function pageHead(
    title: string,
    description: string,
    ogType: string,
    structuredData: unknown,
): HeadTag[] {
    return [
        ["meta", { name: "description", content: description }],
        ["meta", { property: "og:type", content: ogType }],
        ["meta", { property: "og:site_name", content: SITE_NAME }],
        ["meta", { property: "og:locale", content: "en_US" }],
        ["meta", { property: "og:title", content: title }],
        ["meta", { property: "og:description", content: description }],
        ["meta", { property: "og:url", content: DOCS_BASE_URL }],
        ["meta", { name: "twitter:card", content: "summary_large_image" }],
        ["meta", { name: "twitter:title", content: title }],
        ["meta", { name: "twitter:description", content: description }],
        ["meta", { name: "twitter:url", content: DOCS_BASE_URL }],
        ["script", { type: "application/ld+json" }, jsonLd(structuredData)],
    ];
}

function renderLanding(categories: [string, AlgorithmMeta[]][], total: number): string {
    const title = `${SITE_NAME} - Interactive Algorithms Reference`;
    const description = truncate(
        `A free reference of ${total} algorithms across ${categories.length} categories, with pseudocode, complexity analysis, and interactive visualizations.`,
        160,
    );
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: DOCS_BASE_URL,
        description,
        inLanguage: "en-US",
    };
    const categoryLinks = categories
        .map(([id, items]) => `- [${mdText(categoryLabel(id))}](/categories/${id}/) - ${items.length} ${items.length === 1 ? "algorithm" : "algorithms"}`)
        .join("\n");
    const index = categories
        .map(([id, items]) => {
            const links = items
                .map((item) => `- [${mdText(item.name)}](/algorithms/${item.id}/)`)
                .join("\n");
            return `### ${mdText(categoryLabel(id))}\n\n${links}`;
        })
        .join("\n\n");
    const body =
        `# ${SITE_NAME}\n\n` +
        `A free, offline-capable reference of ${total} algorithms across ${categories.length} categories. ` +
        `Read the pseudocode and complexity, then open any algorithm in the interactive visualizer.\n\n` +
        `<a class="cta" href="${VISUALIZER_URL}">Open the interactive visualizer</a>\n\n` +
        `## Categories\n\n${categoryLinks}\n\n` +
        `## Algorithm index\n\n${index}\n`;
    return frontmatter(title, description, pageHead(title, description, "website", structuredData)) + body;
}

function renderCategoryPage(id: string, items: AlgorithmMeta[]): string {
    const label = categoryLabel(id);
    const title = `${label} Algorithms - ${SITE_NAME}`;
    const description = truncate(
        `${label} algorithms: ${items.length} visualizable algorithms with pseudocode, complexity analysis, and interactive step-by-step demonstrations.`,
        160,
    );
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${label} Algorithms`,
        description,
        url: `${DOCS_BASE_URL}categories/${id}/`,
        inLanguage: "en-US",
        numberOfItems: items.length,
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: DOCS_BASE_URL },
    };
    const list = items
        .map(
            (item) =>
                `- [${mdText(item.name)}](/algorithms/${item.id}/) - Time \`${item.complexity.time}\`, Space \`${item.complexity.space}\``,
        )
        .join("\n");
    const body =
        `# ${mdText(label)}\n\n` +
        `${items.length} ${items.length === 1 ? "algorithm" : "algorithms"} in this category, each with pseudocode, ` +
        `complexity, and a replayable visualization. See [all categories](/).\n\n` +
        `## Algorithms\n\n${list}\n`;
    return frontmatter(title, description, pageHead(title, description, "website", structuredData)) + body;
}

function renderPseudocode(lines: string[] | undefined): string {
    if (!lines || lines.length === 0) {
        return "_Pseudocode is not yet available for this algorithm._\n";
    }
    const width = String(lines.length).length;
    return (
        fence(
            "text",
            lines.map((line, index) => `${String(index + 1).padStart(width, " ")}  ${line}`),
        ) + "\n"
    );
}

function renderDefaultInput(input: unknown): string {
    let text: string;
    try {
        text = JSON.stringify(input, null, 2) ?? "(none)";
    } catch {
        text = String(input);
    }
    return `${fence("json", text.split("\n"))}\n`;
}

function renderEducation(education: AlgorithmEducation | undefined): string {
    if (!education) return "";
    const blocks: string[] = [];
    for (const section of EDUCATION_SECTIONS) {
        if (!sectionHasContent(education, section)) continue;
        const value = education[section.key];
        let content: string;
        if (section.kind === "list") {
            content = (value as string[]).map((item) => `- ${mdText(item)}`).join("\n");
        } else if (section.key === "workedExample") {
            content = fence("text", String(value).split("\n"));
        } else {
            content = String(value)
                .split(/\n\s*\n/)
                .map((paragraph) => mdText(paragraph.trim()))
                .join("\n\n");
        }
        blocks.push(`## ${section.title}\n\n${content}`);
    }
    return blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "";
}

function renderAlgorithmPage(
    meta: AlgorithmMeta,
    pseudocode: string[] | undefined,
    education: AlgorithmEducation | undefined,
): string {
    const label = categoryLabel(meta.category);
    const title = `${meta.name} - ${SITE_NAME}`;
    const description = truncate(
        `${meta.name} - ${label}: pseudocode, ${meta.complexity.time} time and ${meta.complexity.space} space complexity, with an interactive step-by-step visualization.`,
        160,
    );
    const url = `${DOCS_BASE_URL}algorithms/${meta.id}/`;
    const structuredData: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        name: meta.name,
        headline: meta.name,
        description,
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        inLanguage: "en-US",
        about: { "@type": "Thing", name: label },
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: DOCS_BASE_URL },
        additionalProperty: [
            { "@type": "PropertyValue", name: "Time complexity", value: meta.complexity.time },
            { "@type": "PropertyValue", name: "Space complexity", value: meta.complexity.space },
        ],
    };
    if (education) {
        if (education.intuition) structuredData.abstract = education.intuition;
        structuredData.articleBody = educationArticleBody(education);
        if (education.uses.length > 0) structuredData.keywords = education.uses.join(", ");
        if (education.references.length > 0) {
            structuredData.citation = education.references.map((reference) => ({
                "@type": "CreativeWork",
                name: reference,
            }));
        }
    }
    const visualizerHref = `${VISUALIZER_URL}?${DEEP_LINK_PARAM}=${encodeURIComponent(meta.id)}`;
    const body =
        `# ${mdText(meta.name)}\n\n` +
        `Category: [${mdText(label)}](/categories/${meta.category}/)\n\n` +
        `| Metric | Complexity |\n| --- | --- |\n` +
        `| Time complexity | \`${meta.complexity.time}\` |\n` +
        `| Space complexity | \`${meta.complexity.space}\` |\n\n` +
        `<a class="cta" href="${visualizerHref}">Open in the interactive visualizer</a>\n\n` +
        `## Pseudocode\n\n${renderPseudocode(pseudocode)}\n` +
        `## Default input\n\n${renderDefaultInput(meta.defaultInput)}\n` +
        renderEducation(education);
    return frontmatter(title, description, pageHead(title, description, "article", structuredData)) + body;
}

/* ------------------------------------------------------------------ */
/* Config generation                                                   */
/* ------------------------------------------------------------------ */

function generateConfig(categories: [string, AlgorithmMeta[]][], nav: unknown[], sidebar: unknown[]): string {
    const siteDescription = truncate(
        `A free reference of ${MANIFEST.length} algorithms across ${categories.length} categories, with pseudocode, complexity analysis, and interactive visualizations.`,
        160,
    );
    const globalHead: HeadTag[] = [
        ["meta", { property: "og:type", content: "website" }],
        ["meta", { property: "og:site_name", content: SITE_NAME }],
        ["meta", { property: "og:locale", content: "en_US" }],
        ["meta", { property: "og:image", content: OG_IMAGE_URL }],
        ["meta", { property: "og:url", content: DOCS_BASE_URL }],
        ["meta", { name: "twitter:card", content: "summary_large_image" }],
        ["meta", { name: "twitter:image", content: OG_IMAGE_URL }],
        ["meta", { name: "twitter:url", content: DOCS_BASE_URL }],
        [
            "script",
            { type: "application/ld+json" },
            jsonLd({
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                name: SITE_NAME,
                applicationCategory: "EducationalApplication",
                operatingSystem: "Web",
                url: VISUALIZER_URL,
                description: siteDescription,
                inLanguage: "en-US",
            }),
        ],
        [
            "script",
            { type: "application/ld+json" },
            jsonLd({
                "@context": "https://schema.org",
                "@type": "LearningResource",
                name: SITE_NAME,
                url: DOCS_BASE_URL,
                description: siteDescription,
                inLanguage: "en-US",
                learningResourceType: "Interactive visualization and reference",
                isPartOf: { "@type": "WebSite", name: SITE_NAME, url: DOCS_BASE_URL },
            }),
        ],
    ];
    const j = (value: unknown): string => JSON.stringify(value, null, 2);

    return `import { defineConfig } from "vitepress";

const CANONICAL_BASE = ${j(DOCS_BASE_URL)};

export default defineConfig({
    base: ${j(DOCS_BASE)},
    lang: "en-US",
    title: ${j(SITE_NAME)},
    description: ${j(siteDescription)},
    appearance: true,
    head: ${j(globalHead)},
    transformHead({ pageData }) {
        const route = pageData.relativePath
            .replace(/(^|\\/)index\\.md$/, "$1")
            .replace(/\\.md$/, "")
            .replace(/\\/+$/, "");
        const url = CANONICAL_BASE + (route ? route + "/" : "");
        return [["link", { rel: "canonical", href: url }]];
    },
    themeConfig: {
        nav: ${j(nav)},
        sidebar: ${j(sidebar)},
        search: { provider: "local" },
        outline: [2, 3],
    },
    vite: {
        build: { chunkSizeWarningLimit: 5000 },
    },
});
`;
}

/* ------------------------------------------------------------------ */
/* Loading and verification                                            */
/* ------------------------------------------------------------------ */

interface LoadFailure {
    id: string;
    message: string;
}

async function loadModuleContent(): Promise<{
    pseudocode: Map<string, string[]>;
    education: Map<string, AlgorithmEducation>;
    failures: LoadFailure[];
}> {
    const pseudocode = new Map<string, string[]>();
    const education = new Map<string, AlgorithmEducation>();
    const failures: LoadFailure[] = [];
    for (let offset = 0; offset < MANIFEST.length; offset += LOAD_CONCURRENCY) {
        const batch = MANIFEST.slice(offset, offset + LOAD_CONCURRENCY);
        await Promise.all(
            batch.map(async (meta) => {
                try {
                    const loader = LOADERS[meta.id];
                    if (!loader) {
                        failures.push({ id: meta.id, message: "no loader registered" });
                        return;
                    }
                    const module = (await loader()).default;
                    if (Array.isArray(module?.pseudocode)) {
                        pseudocode.set(meta.id, module.pseudocode.map(String));
                    }
                    const normalized = normalizeEducation(module?.education);
                    if (normalized) {
                        education.set(meta.id, normalized);
                    }
                } catch (error) {
                    failures.push({
                        id: meta.id,
                        message: error instanceof Error ? error.message : String(error),
                    });
                }
            }),
        );
    }
    return { pseudocode, education, failures };
}

function verify(
    files: Map<string, string>,
    routes: Set<string>,
    categories: [string, AlgorithmMeta[]][],
    sidebarLinks: string[],
): string[] {
    const problems: string[] = [];
    const manifestIds = new Set(MANIFEST.map((meta) => meta.id));

    const algorithmIds = new Set(
        [...files.keys()]
            .filter((file) => file.startsWith("algorithms/") && file.endsWith("/index.md"))
            .map((file) => file.slice("algorithms/".length, -"/index.md".length)),
    );
    for (const id of manifestIds) {
        if (!algorithmIds.has(id)) problems.push(`missing algorithm page: ${id}`);
    }
    for (const id of algorithmIds) {
        if (!manifestIds.has(id)) problems.push(`orphan algorithm page: ${id}`);
    }

    const categoryIds = new Set(
        [...files.keys()]
            .filter((file) => file.startsWith("categories/") && file.endsWith("/index.md"))
            .map((file) => file.slice("categories/".length, -"/index.md".length)),
    );
    const manifestCategories = new Set(MANIFEST.map((meta) => meta.category));
    for (const id of manifestCategories) {
        if (!categoryIds.has(id)) problems.push(`missing category page: ${id}`);
    }
    for (const id of categoryIds) {
        if (!manifestCategories.has(id)) problems.push(`orphan category page: ${id}`);
    }

    for (const [file, markdown] of files) {
        for (const match of markdown.matchAll(/\]\((\/[^)\s]*)\)/g)) {
            const ref = match[1].split(/[?#]/)[0];
            if (ref && !routes.has(ref)) {
                problems.push(`broken internal link in ${file}: ${ref}`);
            }
        }
    }
    for (const link of sidebarLinks) {
        if (link.startsWith("/") && !routes.has(link)) {
            problems.push(`broken sidebar link: ${link}`);
        }
    }

    const expectedPages = 1 + categories.length + MANIFEST.length;
    if (routes.size !== expectedPages) {
        problems.push(`generated ${routes.size} routes, expected ${expectedPages}`);
    }
    return problems;
}

async function main(): Promise<void> {
    await rm(DOCS_DIR, { recursive: true, force: true });

    const { pseudocode, education, failures } = await loadModuleContent();
    const groups = groupByCategory(MANIFEST);
    const categories = orderedCategories(groups);
    const files = new Map<string, string>();
    const routes = new Set<string>(["/"]);

    files.set("index.md", renderLanding(categories, MANIFEST.length));
    for (const [id, items] of categories) {
        files.set(`categories/${id}/index.md`, renderCategoryPage(id, items));
        routes.add(`/categories/${id}/`);
    }
    for (const meta of MANIFEST) {
        files.set(
            `algorithms/${meta.id}/index.md`,
            renderAlgorithmPage(meta, pseudocode.get(meta.id), education.get(meta.id)),
        );
        routes.add(`/algorithms/${meta.id}/`);
    }

    const nav = [
        { text: "Home", link: "/" },
        { text: "Live visualizer", link: VISUALIZER_URL },
        { text: "GitHub", link: GITHUB_URL },
    ];
    const sidebar = [
        { text: "Home", link: "/" },
        ...categories.map(([id, items]) => ({
            text: `${categoryLabel(id)} (${items.length})`,
            collapsed: true,
            items: items.map((meta) => ({ text: meta.name, link: `/algorithms/${meta.id}/` })),
        })),
    ];
    const sidebarLinks = sidebar.flatMap((entry) => {
        const group = entry as { link?: string; items?: { link: string }[] };
        return [group.link ?? "", ...(group.items ?? []).map((item) => item.link)];
    });

    files.set(
        ".vitepress/config.ts",
        generateConfig(categories, nav, sidebar),
    );
    files.set(".vitepress/theme/index.ts", THEME_INDEX);
    files.set(".vitepress/theme/fonts.css", FONTS_CSS);
    files.set(".vitepress/theme/style.css", STYLE_CSS);

    for (const [relativePath, content] of files) {
        const absolutePath = path.join(DOCS_DIR, relativePath);
        await mkdir(path.dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, content, "utf8");
    }

    const fontDir = path.join(DOCS_DIR, "public/fonts");
    await mkdir(fontDir, { recursive: true });
    for (const font of ["notosans-regular.woff2", "notosans-500.woff2", "notosans-600.woff2"]) {
        await copyFile(path.join(ROOT, "public/fonts", font), path.join(fontDir, font));
    }
    try {
        await copyFile(
            path.join(ROOT, "public/media/og-image.png"),
            path.join(DOCS_DIR, "public/og-image.png"),
        );
    } catch {
        // The OG image is optional; VitePress still builds without it.
    }

    const problems = verify(files, routes, categories, sidebarLinks);
    if (problems.length > 0) {
        console.error("Verification FAILED:");
        for (const problem of problems.slice(0, 50)) console.error(`  - ${problem}`);
        if (problems.length > 50) console.error(`  ... and ${problems.length - 50} more`);
        process.exitCode = 1;
    } else {
        console.log("Verification: all checks passed.");
    }

    console.log("Docs generation complete.");
    console.log(`  Algorithms: ${MANIFEST.length}`);
    console.log(`  Categories: ${categories.length}`);
    console.log(`  Markdown pages: ${routes.size}`);
    console.log(`  Education writeups: ${education.size}/${MANIFEST.length}`);
    console.log(
        `  Pseudocode: ${pseudocode.size}/${MANIFEST.length} modules loaded${
            failures.length > 0 ? ` (${failures.length} failed)` : ""
        }`,
    );
    if (failures.length > 0) {
        for (const failure of failures.slice(0, 20)) {
            console.error(`    - ${failure.id}: ${failure.message}`);
        }
        if (failures.length > 20) console.error(`    ... and ${failures.length - 20} more`);
    }
}

await main();

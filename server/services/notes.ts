import matter from "gray-matter";
import { nanoid } from "nanoid";

import type { NoteItem, ScenarioSegmentation } from "../../schema";
import {
  normalizeScenarioSegmentation,
  safeParseScenarioSegmentation,
} from "./scenario-io";

interface ExportPayload {
  scenario: ScenarioSegmentation;
  analyses: Record<number, string>;
  notes: NoteItem[];
  template?: "standard" | "concise";
}

interface ImportResult {
  subtitle_title: string;
  analyses: Record<number, string>;
  notes: NoteItem[];
  scenario?: ScenarioSegmentation;
}

function parseScenarioSnapshot(raw: unknown): ScenarioSegmentation | undefined {
  return safeParseScenarioSegmentation(raw);
}

export function exportNotesMarkdown({
  scenario,
  analyses,
  notes,
  template = "standard",
}: ExportPayload): string {
  const scenarioSnapshot = normalizeScenarioSegmentation(scenario);

  const frontmatter = {
    subtitle_title: scenarioSnapshot.subtitle_title,
    segmentation_strategy: scenarioSnapshot.segmentation_strategy,
    total_blocks: scenarioSnapshot.total_blocks,
    blocks: scenarioSnapshot.blocks.map((block) => ({
      block_index: block.block_index,
      block_name: block.block_name,
      synopsis: block.synopsis,
      start_line: block.start_line,
      end_line: block.end_line,
    })),
    scenario: scenarioSnapshot,
    notes: notes.map((note) => ({
      block_index: note.block_index,
      order: note.order,
      title: note.title,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })),
    template,
  };

  const body = scenarioSnapshot.blocks
    .map((block) => {
      const analysis = analyses[block.block_index];
      const relatedNotes = notes.filter(
        (note) => note.block_index === block.block_index
      );

      const notesSection =
        relatedNotes.length && template === "standard"
          ? relatedNotes
              .map(
                (note, index) =>
                  `### Note ${index + 1}: ${note.title}\n\n- 行号：${note.order}\n- 更新时间：${note.updatedAt}\n\n${note.content}\n`
              )
              .join("\n")
          : relatedNotes.length
          ? relatedNotes
              .map(
                (note) =>
                  `- 行号 ${note.order}｜${note.title}｜${truncate(note.content, 120)}`
              )
              .join("\n")
          : "_暂无笔记_";

      return [
        `## Block ${block.block_index} · ${block.block_name}`,
        `> 行号：${block.start_line}-${block.end_line}`,
        `> 概要：${block.synopsis}`,
        "",
        "### 学习分析",
        analysis ?? "_尚未生成学习分析_",
        "",
        "### 笔记",
        notesSection,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const file = matter.stringify(body, frontmatter);
  return `# 字幕学习笔记导出\n\n生成时间：${new Date().toISOString()}\n\n${file}`;
}

export function importNotesMarkdown(markdown: string): ImportResult {
  const parsed = matter(markdown);
  const data = parsed.data as Record<string, unknown>;
  const body = parsed.content;

  const scenario = parseScenarioSnapshot(data.scenario);

  const subtitleTitle =
    typeof data.subtitle_title === "string"
      ? data.subtitle_title
      : "Imported Subtitle";

  const analyses = extractAnalysesFromBody(body);

  const notesRaw = Array.isArray(data.notes) ? data.notes : [];
  const notes: NoteItem[] = notesRaw
    .map((item) => ({
      id: nanoid(),
      block_index: Number((item as Record<string, unknown>).block_index ?? 0),
      order: Number((item as Record<string, unknown>).order ?? 0),
      title: String((item as Record<string, unknown>).title ?? "未命名笔记"),
      content: String(
        (item as Record<string, unknown>).content ?? "空内容（导入时缺失）"
      ),
      createdAt:
        String((item as Record<string, unknown>).createdAt ?? "") ||
        new Date().toISOString(),
      updatedAt:
        String((item as Record<string, unknown>).updatedAt ?? "") ||
        new Date().toISOString(),
    }))
    .filter(
      (note) => note.block_index > 0 && note.order > 0 && note.content.length
    );

  return {
    subtitle_title: subtitleTitle,
    analyses,
    notes,
    scenario,
  };
}

function extractAnalysesFromBody(body: string): Record<number, string> {
  const sections = body.split(/\n---\n/);
  const map: Record<number, string> = {};

  sections.forEach((section) => {
    const lines = section.trim().split("\n");
    if (lines.length === 0) return;

    const heading = lines[0];
    const match = heading.match(/^## Block (\d+)/);
    if (!match) return;

    const blockIndex = Number(match[1]);
    const analysisStart = lines.findIndex((line) =>
      line.trim().startsWith("### 学习分析")
    );

    if (analysisStart === -1) return;

    const notesStart = lines.findIndex((line) =>
      line.trim().startsWith("### 笔记")
    );

    const analysisLines =
      notesStart === -1
        ? lines.slice(analysisStart + 1)
        : lines.slice(analysisStart + 1, notesStart);

    const markdown = analysisLines.join("\n").trim();
    if (markdown) {
      map[blockIndex] = markdown;
    }
  });

  return map;
}

export function createEmptyNote(
  blockIndex: number,
  order: number,
  overrides?: Partial<Pick<NoteItem, "title" | "content">>
): NoteItem {
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    block_index: blockIndex,
    order,
    title: overrides?.title ?? "未命名笔记",
    content: overrides?.content ?? "",
    createdAt: now,
    updatedAt: now,
  };
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

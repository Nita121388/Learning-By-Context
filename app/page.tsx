'use client';

import ReactMarkdown from 'react-markdown';
import { useCallback, useMemo, useState } from 'react';
import type {
  NoteItem,
  ScenarioBlock,
  ScenarioSegmentation,
  AnalysisModules,
} from 'schema';
import { useSettings } from '../hooks/use-settings';
import { SettingsDrawer } from '../components/settings-drawer';

interface UploadState {
  isDragging: boolean;
  error?: string;
}

interface LineHoverState {
  blockIndex: number;
  order: number;
}

interface NoteFormState {
  title: string;
  content: string;
}

interface AnalysisContent {
  markdown: string;
  structured?: AnalysisModules;
}

const generateId = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10));

export default function HomePage() {
  const [subtitleText, setSubtitleText] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({
    isDragging: false,
  });
  const [segmentation, setSegmentation] =
    useState<ScenarioSegmentation | null>(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(
    null,
  );
  const [hoverState, setHoverState] = useState<LineHoverState | null>(null);
  const [analysisMap, setAnalysisMap] = useState<Record<number, AnalysisContent>>({});
  const [loadingBlocks, setLoadingBlocks] = useState<Set<number>>(new Set());
  const [isBulkLoading, setBulkLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [notesByBlock, setNotesByBlock] = useState<Record<number, NoteItem[]>>(
    {},
  );
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [noteFormState, setNoteFormState] = useState<NoteFormState>({
    title: '',
    content: '',
  });
  const [noteFormTarget, setNoteFormTarget] =
    useState<LineHoverState | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [scenarioExporting, setScenarioExporting] = useState(false);
  const [scenarioExportError, setScenarioExportError] = useState<string | null>(
    null,
  );
  const [scenarioImporting, setScenarioImporting] = useState(false);
  const [scenarioImportError, setScenarioImportError] =
    useState<string | null>(null);
  const { state: settings } = useSettings();

  const sortedBlocks = useMemo(() => {
    if (!segmentation) {
      return [];
    }
    return [...segmentation.blocks].sort(
      (a, b) => a.block_index - b.block_index,
    );
  }, [segmentation]);

  const activeBlock = useMemo<ScenarioBlock | null>(() => {
    if (!segmentation || selectedBlockIndex == null) {
      return sortedBlocks.length > 0 ? sortedBlocks[0] : null;
    }
    return segmentation.blocks.find(
      (block) => block.block_index === selectedBlockIndex,
    ) ?? sortedBlocks[0] ?? null;
  }, [segmentation, selectedBlockIndex, sortedBlocks]);

  const activeNotes = useMemo<NoteItem[]>(() => {
    if (!activeBlock) {
      return [];
    }
    return notesByBlock[activeBlock.block_index] ?? [];
  }, [notesByBlock, activeBlock]);

  const activeAnalysis = useMemo<AnalysisContent | undefined>(() => {
    if (!activeBlock) {
      return undefined;
    }
    return analysisMap[activeBlock.block_index];
  }, [analysisMap, activeBlock]);

  const hasNotes = useMemo(() => {
    return Object.values(notesByBlock).some((items) => items.length > 0);
  }, [notesByBlock]);

  const allNotes = useMemo<NoteItem[]>(() => {
    return Object.values(notesByBlock).flat();
  }, [notesByBlock]);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSubtitleText(event.target.value);
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomTitle(event.target.value);
  };

  const parseFile = useCallback(async (file: File) => {
    const text = await file.text();
    setSubtitleText(text);
    if (!customTitle) {
      const derived = file.name.replace(/\.[^.]+$/, '');
      setCustomTitle(derived);
    }
  }, [customTitle]);

  const onFileInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      await parseFile(file);
    }
  };

  const onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setUploadState((prev) => ({ ...prev, isDragging: false }));
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await parseFile(file);
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!uploadState.isDragging) {
      setUploadState((prev) => ({ ...prev, isDragging: true }));
    }
  };

  const onDragLeave = () => {
    setUploadState((prev) => ({ ...prev, isDragging: false }));
  };

  const submitSubtitle = async () => {
    setSubmitting(true);
    setUploadState((prev) => ({ ...prev, error: undefined }));
    setSegmentation(null);
    setSelectedBlockIndex(null);
    setAnalysisMap({});
    setLoadingBlocks(new Set());
    setBulkLoading(false);
    setAnalysisError(null);
    setNotesByBlock({});
    setNoteFormOpen(false);
    setNoteFormTarget(null);
    setNotesError(null);

    try {
      const response = await fetch('/api/subtitles/segment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subtitle: subtitleText,
          title: customTitle.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.details ?? payload?.error ?? '分块失败');
      }

      const data = (await response.json()) as ScenarioSegmentation;
      setSegmentation(data);
      setSelectedBlockIndex(
        data.blocks.length > 0 ? data.blocks[0].block_index : null,
      );
      setAnalysisMap({});
    } catch (error) {
      setUploadState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : '分块过程中出现未知错误，请重试。',
      }));
    } finally {
      setSubmitting(false);
    }
  };

  const setBlockLoading = useCallback((index: number, loading: boolean) => {
    setLoadingBlocks((prev) => {
      const next = new Set(prev);
      if (loading) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  }, []);

  const createClientNote = useCallback(
    (blockIndex: number, order: number, data: NoteFormState): NoteItem => {
      const now = new Date().toISOString();
      const title = data.title.trim() || `行 #${order} 笔记`;
      const content = data.content.trim();
      return {
        id: generateId(),
        block_index: blockIndex,
        order,
        title,
        content,
        createdAt: now,
        updatedAt: now,
      };
    },
    [],
  );

  const addNote = useCallback(
    (blockIndex: number, order: number, data: NoteFormState) => {
      const note = createClientNote(blockIndex, order, data);
      setNotesByBlock((prev) => {
        const next = { ...prev };
        const list = next[blockIndex] ?? [];
        next[blockIndex] = [...list, note];
        return next;
      });
    },
    [createClientNote],
  );

  const removeNote = useCallback((blockIndex: number, noteId: string) => {
    setNotesByBlock((prev) => {
      const list = prev[blockIndex];
      if (!list) return prev;
      const filtered = list.filter((note) => note.id !== noteId);
      return {
        ...prev,
        [blockIndex]: filtered,
      };
    });
  }, []);

  const fetchAnalysisForBlock = async (blockIndex: number | null) => {
    if (!segmentation) {
      setAnalysisError('请先完成字幕情景分块。');
      return;
    }
    const targetIndex = blockIndex ?? selectedBlockIndex ?? segmentation.blocks[0]?.block_index;
    if (targetIndex == null) {
      setAnalysisError('未找到可分析的情景模块。');
      return;
    }
    const targetBlock = segmentation.blocks.find(
      (block) => block.block_index === targetIndex,
    );
    if (!targetBlock) {
      setAnalysisError('情景模块数据不存在，请重新分块。');
      return;
    }
    setAnalysisError(null);
    setBlockLoading(targetIndex, true);
    try {
      await requestAnalysis([targetBlock.block_index]);
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : '学习分析过程中出现未知错误，请重试。',
      );
    } finally {
      setBlockLoading(targetIndex, false);
    }
  };

  const fetchAnalysisForAll = async () => {
    if (!segmentation) {
      setAnalysisError('请先完成字幕情景分块。');
      return;
    }
    const indexes = segmentation.blocks.map((block) => block.block_index);
    if (indexes.length === 0) {
      setAnalysisError('没有可分析的情景模块。');
      return;
    }
    setAnalysisError(null);
    setBulkLoading(true);
    setLoadingBlocks(new Set(indexes));
    try {
      await requestAnalysis(indexes);
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : '学习分析过程中出现未知错误，请重试。',
      );
    } finally {
      setBulkLoading(false);
      setLoadingBlocks(new Set());
    }
  };

  const requestAnalysis = async (blockIndexes: number[]) => {
    if (!segmentation) {
      return;
    }
    const response = await fetch('/api/scenarios/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subtitle_title: segmentation.subtitle_title,
        blocks: segmentation.blocks,
        block_indexes: blockIndexes,
        config: {
          model: settings.model,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          cacheTTL: settings.analysisCacheTTL,
          examTargets: settings.examTargets,
        },
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.details ?? payload?.error ?? '学习分析失败');
    }

    const payload = (await response.json()) as {
      blocks: {
        block_index: number;
        block_name: string;
        markdown: string;
        structured?: AnalysisModules;
      }[];
    };

    setAnalysisMap((prev) => {
      const next: Record<number, AnalysisContent> = { ...prev };
      payload.blocks.forEach((item) => {
        next[item.block_index] = {
          markdown: item.markdown,
          structured: item.structured,
        };
      });
      return next;
    });
  };

  const openNoteForm = () => {
    if (!activeBlock || !hoverState || hoverState.blockIndex !== activeBlock.block_index) {
      setNotesError('请先将鼠标悬停在需要记录的字幕行上。');
      return;
    }
    setNotesError(null);
    setNoteFormTarget(hoverState);
    setNoteFormState({
      title: '',
      content: '',
    });
    setNoteFormOpen(true);
  };

  const cancelNoteForm = () => {
    setNoteFormOpen(false);
    setNoteFormTarget(null);
  };

  const submitNoteForm = () => {
    if (!activeBlock || !noteFormTarget) {
      setNotesError('缺少笔记绑定的模块或行，请重试。');
      return;
    }
    if (!noteFormState.content.trim()) {
      setNotesError('笔记内容不能为空。');
      return;
    }
    addNote(activeBlock.block_index, noteFormTarget.order, noteFormState);
    setNoteFormOpen(false);
    setNoteFormTarget(null);
    setNoteFormState({ title: '', content: '' });
    setNotesError(null);
  };

  const applyScenarioSnapshot = (
    snapshot: ScenarioSegmentation,
    options?: {
      analyses?: Record<number, AnalysisContent>;
      notes?: NoteItem[];
      preserveExisting?: boolean;
    },
  ) => {
    setSegmentation(snapshot);
    setSelectedBlockIndex(snapshot.blocks[0]?.block_index ?? null);
    setCustomTitle(snapshot.subtitle_title);

    const transcriptLines = snapshot.blocks
      .flatMap((block) => block.dialogues)
      .sort((a, b) => a.order - b.order)
      .map((line) => {
        const speaker = line.speaker ? `${line.speaker}: ` : '';
        return `${line.order}. ${speaker}${line.text}`;
      })
      .join('\n');
    if (transcriptLines) {
      setSubtitleText(transcriptLines);
    }

    const validBlocks = new Set(
      snapshot.blocks.map((block) => block.block_index),
    );

    setAnalysisMap((prev) => {
      const next: Record<number, AnalysisContent> = {};

      if (options?.preserveExisting) {
        Object.entries(prev).forEach(([key, value]) => {
          const index = Number(key);
          if (Number.isInteger(index) && validBlocks.has(index)) {
            next[index] = value;
          }
        });
      }

      Object.entries(options?.analyses ?? {}).forEach(([key, value]) => {
        const index = Number(key);
        if (Number.isInteger(index) && validBlocks.has(index)) {
          next[index] = value;
        }
      });

      return next;
    });

    setNotesByBlock((prev) => {
      const preserved: Record<number, NoteItem[]> = {};
      if (options?.preserveExisting) {
        Object.entries(prev).forEach(([key, list]) => {
          const index = Number(key);
          if (
            Number.isInteger(index) &&
            validBlocks.has(index) &&
            list.length
          ) {
            preserved[index] = [...list];
          }
        });
      }

      (options?.notes ?? []).forEach((note) => {
        if (validBlocks.has(note.block_index)) {
          preserved[note.block_index] = [
            ...(preserved[note.block_index] ?? []),
            note,
          ];
        }
      });

      return options?.preserveExisting ? preserved : { ...preserved };
    });
  };
  const handleScenarioExport = async () => {
    if (!segmentation) {
      setScenarioExportError('当前没有可导出的情景分块，请先完成分块。');
      return;
    }
    setScenarioExportError(null);
    setScenarioExporting(true);
    try {
      const response = await fetch('/api/scenario/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenario: segmentation,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.details ?? payload?.error ?? '导出失败');
      }
      const payload = (await response.json()) as {
        content: string;
        filename: string;
      };
      const blob = new Blob([payload.content], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = payload.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setScenarioExportError(
        error instanceof Error
          ? error.message
          : '导出情景分块时出现未知错误，请稍后重试。',
      );
    } finally {
      setScenarioExporting(false);
    }
  };

  const handleScenarioImport = async (file: File) => {
    const content = await file.text();
    setScenarioImportError(null);
    setScenarioImporting(true);
    try {
      const response = await fetch('/api/scenario/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.details ?? payload?.error ?? '导入失败');
      }
      const payload = (await response.json()) as {
        scenario: ScenarioSegmentation;
        importedAt: string;
      };
      applyScenarioSnapshot(payload.scenario, {
        preserveExisting: false,
      });
      setScenarioImportError(null);
    } catch (error) {
      setScenarioImportError(
        error instanceof Error
          ? error.message
          : '导入情景分块时出现未知错误，请稍后重试。',
      );
    } finally {
      setScenarioImporting(false);
    }
  };
  const handleExport = async () => {
    if (!segmentation) {
      setExportError('请先完成字幕情景分块。');
      return;
    }
    setExportError(null);
    setExporting(true);
    try {
      const response = await fetch('/api/notes/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenario: segmentation,
          analyses: Object.fromEntries(
            Object.entries(analysisMap).map(([key, value]) => [key, value.markdown])
          ),
          notes: allNotes,
          template: settings.exportTemplate,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.details ?? payload?.error ?? '导出失败');
      }
      const { markdown } = (await response.json()) as { markdown: string };
      const blob = new Blob([markdown], {
        type: 'text/markdown;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename =
        (segmentation.subtitle_title || 'subtitle-notes').replace(/\s+/g, '-') +
        `-${Date.now()}.md`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : '导出笔记时出现未知错误。',
      );
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    const markdown = await file.text();
    setImportError(null);
    try {
      const response = await fetch('/api/notes/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markdown }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.details ?? payload?.error ?? '导入失败');
      }
      const result = (await response.json()) as {
        subtitle_title: string;
        analyses: Record<number, string>;
        notes: NoteItem[];
        scenario?: ScenarioSegmentation;
      };

      const importedAnalyses: Record<number, AnalysisContent> = {};
      Object.entries(result.analyses ?? {}).forEach(([key, value]) => {
        const index = Number(key);
        if (Number.isInteger(index) && index > 0) {
          importedAnalyses[index] = { markdown: value, structured: undefined };
        }
      });

      if (result.scenario) {
        applyScenarioSnapshot(result.scenario, {
          analyses: importedAnalyses,
          notes: result.notes,
          preserveExisting: false,
        });
      } else if (segmentation) {
        applyScenarioSnapshot(segmentation, {
          analyses: importedAnalyses,
          notes: result.notes,
          preserveExisting: true,
        });
      } else {
        setImportError('导入了笔记，但当前没有情景分块数据，请先完成分块。');
        return;
      }

      if (
        (result.notes?.length ?? 0) === 0 &&
        Object.keys(result.analyses ?? {}).length === 0
      ) {
        setImportError('导入文件未包含新的笔记或学习分析。');
      }
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : '导入笔记时出现未知错误，请重试。',
      );
    }
  };

  const renderBlockMeta = (block: ScenarioBlock) => {
    return (
      <div className="flex flex-col gap-1 text-xs text-slate-400">
        <p>
          行号：{block.start_line} - {block.end_line}
        </p>
        {block.context_tags?.length ? (
          <p>语境：{block.context_tags.join('，')}</p>
        ) : null}
        {block.exam_alignment?.length ? (
          <p>考试：{block.exam_alignment.join('，')}</p>
        ) : null}
        {block.difficulty ? <p>难度：{block.difficulty}</p> : null}
      </div>
    );
  };

  const renderDialogues = (block: ScenarioBlock) => {
    return block.dialogues.map((dialogue) => {
      const isHovered =
        hoverState?.blockIndex === block.block_index &&
        hoverState?.order === dialogue.order;
      return (
        <button
          key={`${block.block_index}-${dialogue.order}`}
          type="button"
          onMouseEnter={() =>
            setHoverState({
              blockIndex: block.block_index,
              order: dialogue.order,
            })
          }
          onMouseLeave={() => setHoverState(null)}
          onClick={() => setSelectedBlockIndex(block.block_index)}
          className={`w-full rounded-lg px-3 py-2 text-left transition ${
            isHovered
              ? 'bg-emerald-500/20 text-emerald-100'
              : 'bg-slate-900/40 text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <span className="text-xs font-mono text-slate-400">
            #{dialogue.order}
          </span>{' '}
          <span className="font-semibold">
            {dialogue.speaker ?? 'Unknown'}:
          </span>{' '}
          <span>{dialogue.text}</span>
        </button>
      );
    });
  };

  const renderAnalysisContent = useCallback((content: AnalysisContent) => {
    if (!content.structured) {
      return (
        <div className="prose prose-invert max-w-none prose-headings:text-slate-50 prose-li:marker:text-emerald-300 prose-strong:text-emerald-200">
          <ReactMarkdown>{content.markdown}</ReactMarkdown>
        </div>
      );
    }

    const { vocabulary, grammar, listening_pronunciation, culture_context, practice } =
      content.structured;

    return (
      <div className="space-y-4">
        <section className="space-y-3 rounded-lg border border-emerald-500/30 bg-slate-900/60 p-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-emerald-200">Module 1 · 词汇与短语</h3>
            {vocabulary.focus_exams.length ? (
              <span className="text-[11px] text-emerald-300">
                重点考试：{vocabulary.focus_exams.join(' / ')}
              </span>
            ) : null}
          </header>
          <div className="space-y-4 text-xs text-slate-200">
            {vocabulary.core.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">核心考试词汇</p>
                <ul className="mt-2 space-y-2">
                  {vocabulary.core.map((item, index) => (
                    <li
                      key={`${item.term}-${index}`}
                      className="space-y-1 rounded-md border border-slate-800 bg-slate-950/60 p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-emerald-100">
                        <span className="font-semibold">{item.term}</span>
                        {item.phonetic ? (
                          <span className="text-xs text-slate-400">/{item.phonetic}/</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-300">
                        {item.meaning_cn || item.meaning_en || '暂无释义'}
                      </p>
                      {item.exam_tags?.length ? (
                        <p className="text-[11px] text-emerald-300">
                          考试标签：{item.exam_tags.join(' / ')}
                        </p>
                      ) : null}
                      {item.subtitle_example ? (
                        <p className="text-[11px] text-slate-400">
                          字幕例句：{item.subtitle_example.sentence}
                        </p>
                      ) : null}
                      {item.exam_example ? (
                        <p className="text-[11px] text-slate-400">
                          考试例句：{item.exam_example.sentence}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {vocabulary.phrases.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">高频短语</p>
                <ul className="mt-2 space-y-2">
                  {vocabulary.phrases.map((item, index) => (
                    <li
                      key={`${item.phrase}-${index}`}
                      className="rounded-md border border-slate-800 bg-slate-950/60 p-3"
                    >
                      <p className="text-sm text-emerald-100">{item.phrase}</p>
                      <p className="text-xs text-slate-300">
                        {item.meaning_cn || item.meaning_en || '暂无释义'}
                      </p>
                      {item.usage_tip ? (
                        <p className="text-[11px] text-slate-400">用法提示：{item.usage_tip}</p>
                      ) : null}
                      {item.example ? (
                        <p className="text-[11px] text-slate-400">
                          例句：{item.example.sentence}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {vocabulary.extension.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">表达拓展</p>
                <ul className="mt-2 space-y-1">
                  {vocabulary.extension.map((item, index) => (
                    <li key={`${item.term}-${index}`} className="text-xs text-slate-300">
                      <span className="font-semibold text-emerald-200">{item.term}</span> ·{' '}
                      {item.meaning_cn || item.usage_tip || '可扩展表达'}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-emerald-500/30 bg-slate-900/60 p-4">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-200">Module 2 · 语法与句型</h3>
          </header>
          <div className="space-y-3 text-xs text-slate-200">
            {grammar.sentence_breakdown.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">句子结构拆解</p>
                <ul className="mt-2 space-y-1">
                  {grammar.sentence_breakdown.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {grammar.grammar_points.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">重点语法</p>
                <ul className="mt-2 space-y-2">
                  {grammar.grammar_points.map((point, index) => (
                    <li
                      key={`${point.title}-${index}`}
                      className="rounded-md border border-slate-800 bg-slate-950/60 p-3"
                    >
                      <p className="text-sm text-emerald-100">{point.title}</p>
                      <p className="text-xs text-slate-300">{point.explanation || '暂无说明'}</p>
                      {point.structure ? (
                        <p className="text-[11px] text-slate-400">结构：{point.structure}</p>
                      ) : null}
                      {point.examples?.length ? (
                        <ul className="mt-1 space-y-1 text-[11px] text-slate-400">
                          {point.examples.map((example, exampleIndex) => (
                            <li key={exampleIndex}>例句：{example.sentence}</li>
                          ))}
                        </ul>
                      ) : null}
                      {point.exam_focus ? (
                        <p className="text-[11px] text-emerald-300">考试提示：{point.exam_focus}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {grammar.application.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">写作/口语应用</p>
                <ul className="mt-2 space-y-1">
                  {grammar.application.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-emerald-500/30 bg-slate-900/60 p-4">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-200">Module 3 · 听力与发音</h3>
          </header>
          <div className="space-y-3 text-xs text-slate-200">
            {listening_pronunciation.keyword_pronunciations.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">核心词汇发音</p>
                <ul className="mt-2 space-y-1">
                  {listening_pronunciation.keyword_pronunciations.map((item, index) => (
                    <li key={`${item.term}-${index}`}>
                      <span className="font-semibold text-emerald-100">{item.term}</span>{' '}
                      {item.ipa ? `/${item.ipa}/` : ''} {item.tip ? `· ${item.tip}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {listening_pronunciation.connected_speech.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">连读与弱读</p>
                <ul className="mt-2 space-y-1">
                  {listening_pronunciation.connected_speech.map((item, index) => (
                    <li key={`${item.phenomenon}-${index}`}>
                      <span className="font-semibold text-emerald-100">{item.phenomenon}</span> ·{' '}
                      {item.explanation || '听力要点'}
                      {item.example ? `（${item.example}）` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {listening_pronunciation.listening_strategies.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">听力策略</p>
                <ul className="mt-2 space-y-1">
                  {listening_pronunciation.listening_strategies.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-emerald-500/30 bg-slate-900/60 p-4">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-200">Module 4 · 文化与语境</h3>
          </header>
          <div className="space-y-3 text-xs text-slate-200">
            {culture_context.slang_or_register.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">俚语与语域</p>
                <ul className="mt-2 space-y-1">
                  {culture_context.slang_or_register.map((item, index) => (
                    <li key={`${item.expression}-${index}`}>
                      <span className="font-semibold text-emerald-100">{item.expression}</span> ·{' '}
                      {item.meaning || '语义说明'}
                      {item.exam_warning ? `（考试提醒：${item.exam_warning}）` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {culture_context.cultural_notes.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">文化背景</p>
                <ul className="mt-2 space-y-1">
                  {culture_context.cultural_notes.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {culture_context.pragmatic_functions.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">语用功能</p>
                <ul className="mt-2 space-y-1">
                  {culture_context.pragmatic_functions.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-emerald-500/30 bg-slate-900/60 p-4">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-200">Module 5 · 应试实践</h3>
          </header>
          <div className="space-y-3 text-xs text-slate-200">
            {practice.comprehension_checks.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">理解检核</p>
                <ul className="mt-2 space-y-1">
                  {practice.comprehension_checks.map((item, index) => (
                    <li key={index}>
                      <p className="font-semibold text-emerald-100">
                        Q{index + 1}：{item.question}
                      </p>
                      {item.answer ? <p>答案：{item.answer}</p> : null}
                      {item.explanation ? <p>解析：{item.explanation}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {practice.rewriting_tasks.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">仿写与替换</p>
                <ul className="mt-2 space-y-1">
                  {practice.rewriting_tasks.map((task, index) => (
                    <li key={index}>
                      <p className="font-semibold text-emerald-100">{task.instruction}</p>
                      {task.target_words?.length ? (
                        <p>目标词：{task.target_words.join(' / ')}</p>
                      ) : null}
                      {task.reference ? <p>示例：{task.reference}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {practice.speaking_prompts.length ? (
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">口语拓展</p>
                <ul className="mt-2 space-y-1">
                  {practice.speaking_prompts.map((prompt, index) => (
                    <li key={index}>{prompt}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {content.markdown ? (
          <div className="prose prose-invert max-w-none rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-100">
            <ReactMarkdown>{content.markdown}</ReactMarkdown>
          </div>
        ) : null}
      </div>
    );
  }, []);

  const renderLearningFocus = (block: ScenarioBlock) => {
    if (!block.learning_focus) {
      return null;
    }
    const { vocabulary, grammar, listening, culture } = block.learning_focus;
    return (
      <dl className="grid gap-3 text-sm text-slate-200">
        {vocabulary ? (
          <div>
            <dt className="font-semibold text-emerald-300">词汇聚焦</dt>
            <dd>{vocabulary}</dd>
          </div>
        ) : null}
        {grammar ? (
          <div>
            <dt className="font-semibold text-emerald-300">语法聚焦</dt>
            <dd>{grammar}</dd>
          </div>
        ) : null}
        {listening ? (
          <div>
            <dt className="font-semibold text-emerald-300">听力策略</dt>
            <dd>{listening}</dd>
          </div>
        ) : null}
        {culture ? (
          <div>
            <dt className="font-semibold text-emerald-300">文化提示</dt>
            <dd>{culture}</dd>
          </div>
        ) : null}
      </dl>
    );
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-50">
            字幕情景分块 · 最小可用工具
          </h1>
          <p className="text-sm text-slate-400">
            支持粘贴字幕、拖拽或选择文件，调用 Spike4 能力完成情景分块。后续将逐步接入学习分析与笔记功能。
          </p>
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-900 bg-slate-900/60 p-6 shadow-lg shadow-slate-900/40 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <h2 className="text-lg font-semibold text-slate-50">
              1. 导入字幕
            </h2>
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                uploadState.isDragging
                  ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                  : 'border-slate-700 bg-slate-900/40 text-slate-400 hover:border-emerald-400'
              }`}
            >
              <p className="text-sm font-medium">
                拖拽文件到此处，或点击下方按钮选择字幕文件（txt/srt/md）
              </p>
              <input
                type="file"
                accept=".txt,.srt,.md"
                onChange={onFileInputChange}
                className="mt-3 text-sm text-slate-300"
              />
            </div>

            <label className="block space-y-2 text-sm">
              <span className="text-slate-300">自定义标题（可选）</span>
              <input
                value={customTitle}
                onChange={handleTitleChange}
                placeholder="例如：Galactic Defiance Meeting"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
            </label>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <label className="flex items-center justify-between text-sm text-slate-300">
              <span>粘贴字幕文本</span>
              <span className="text-xs text-slate-500">
                当前字数：{subtitleText.length}
              </span>
            </label>
            <textarea
              value={subtitleText}
              onChange={handleTextChange}
              rows={14}
              placeholder="在此粘贴字幕内容..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-200 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                输入字幕后点击按钮触发情景分块。
              </p>
              <button
                type="button"
                onClick={submitSubtitle}
                disabled={isSubmitting || subtitleText.trim().length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isSubmitting ? '正在分块...' : '执行情景分块'}
              </button>
            </div>
            {uploadState.error ? (
              <p className="text-sm text-red-400">⚠ {uploadState.error}</p>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-slate-900 bg-slate-900/60 p-6 shadow-xl shadow-slate-900/50 lg:grid-cols-2">
          <div className="lg:col-span-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-50">
                2. 字幕与情景模块
              </h2>
              {segmentation ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-medium text-emerald-300">
                    共 {segmentation.blocks.length} 个模块
                  </span>
                  <button
                    type="button"
                    onClick={fetchAnalysisForAll}
                    className="rounded-md border border-emerald-500/40 px-3 py-1 font-medium text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                    disabled={
                      isSubmitting ||
                      isBulkLoading ||
                      segmentation.blocks.length === 0
                    }
                  >
                    {isBulkLoading ? '批量生成中...' : '一键生成全部分析'}
                  </button>
                </div>
              ) : null}
            </div>

            {segmentation ? (
              <div className="space-y-4">
                {sortedBlocks.map((block) => {
                  const isActive =
                    activeBlock?.block_index === block.block_index;
                  const blockAnalysis = analysisMap[block.block_index];
                  return (
                    <div
                      key={block.block_index}
                      className={`rounded-xl border transition ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-800 bg-slate-900/40 hover:border-emerald-500/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedBlockIndex(block.block_index)
                        }
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-50">
                          #{block.block_index} · {block.block_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {block.synopsis}
                        </p>
                      </div>
                        <div className="flex items-center gap-2">
                          {loadingBlocks.has(block.block_index) ? (
                            <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300">
                              生成中
                            </span>
                          ) : blockAnalysis ? (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                              已生成
                            </span>
                          ) : null}
                          <span className="text-xs text-slate-500">
                            行 {block.start_line}-{block.end_line}
                          </span>
                        </div>
                      </button>
                      <div className="space-y-2 px-4 pb-4">
                        {renderDialogues(block)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
                暂无分块结果。导入字幕并执行分块后，这里会展示按模块分组的字幕。
              </p>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-50">
                3. 模块概览与聚焦提示
              </h2>
              {activeBlock ? (
                <span className="text-xs text-slate-500">
                  当前模块：#{activeBlock.block_index}
                </span>
              ) : null}
            </div>

            {activeBlock ? (
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-emerald-300">
                    模块简介
                  </p>
                  <p className="text-sm text-slate-200">{activeBlock.synopsis}</p>
                </div>

                {renderBlockMeta(activeBlock)}

                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    聚焦提示
                  </p>
                  {renderLearningFocus(activeBlock) ?? (
                    <p className="text-xs text-slate-500">
                      暂无聚焦信息，后续可通过 Spike5 自动生成。
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    推荐任务
                  </p>
                  {activeBlock.follow_up_tasks?.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-slate-200">
                      {activeBlock.follow_up_tasks.map((task, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      暂无任务，后续将结合学习分析自动生成。
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-emerald-300">
                      学习分析（Module 1~5）
                    </p>
                    <button
                      type="button"
                      onClick={() => fetchAnalysisForBlock(activeBlock.block_index)}
                      className="rounded-md border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                    disabled={
                      loadingBlocks.has(activeBlock.block_index) ||
                      isSubmitting ||
                      isBulkLoading
                    }
                    >
                    {activeAnalysis
                      ? loadingBlocks.has(activeBlock.block_index)
                        ? '重新生成中...'
                        : '重新生成分析'
                      : loadingBlocks.has(activeBlock.block_index)
                        ? '生成中...'
                        : '生成学习分析'}
                  </button>
                  </div>
                  {analysisError ? (
                    <p className="text-xs text-red-400">⚠ {analysisError}</p>
                  ) : null}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-100">
                    {activeAnalysis ? (
                      renderAnalysisContent(activeAnalysis)
                    ) : (
                      <p className="text-xs text-slate-500">
                        ����ѧϰ����������Ϸ���ť���� Spike5 �����Զ����� Module 1~5 ���ݡ�
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-emerald-300">
                      笔记管理
                    </p>
                    <span className="text-xs text-slate-500">
                      当前模块共 {activeNotes.length} 条
                    </span>
                  </div>
                  {notesError ? (
                    <p className="text-xs text-red-400">⚠ {notesError}</p>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      鼠标悬停字幕行可快速添加笔记，记录个人理解与重点。
                    </p>
                    <button
                      type="button"
                      onClick={openNoteForm}
                      className="self-start rounded-md border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                      disabled={
                        !hoverState ||
                        !activeBlock ||
                        hoverState.blockIndex !== activeBlock.block_index
                      }
                    >
                      {hoverState &&
                      activeBlock &&
                      hoverState.blockIndex === activeBlock.block_index
                        ? `添加行 #${hoverState.order} 笔记`
                        : '悬停字幕行以添加笔记'}
                    </button>
                  </div>

                  {noteFormOpen && noteFormTarget ? (
                    <div className="space-y-2 rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-4">
                      <p className="text-xs font-semibold text-emerald-200">
                        针对行 #{noteFormTarget.order} 添加笔记
                      </p>
                      <label className="block space-y-1 text-xs text-slate-300">
                        <span>标题</span>
                        <input
                          value={noteFormState.title}
                          onChange={(event) =>
                            setNoteFormState((prev) => ({
                              ...prev,
                              title: event.target.value,
                            }))
                          }
                          placeholder="可选：为笔记命名"
                          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                        />
                      </label>
                      <label className="block space-y-1 text-xs text-slate-300">
                        <span>内容</span>
                        <textarea
                          value={noteFormState.content}
                          onChange={(event) =>
                            setNoteFormState((prev) => ({
                              ...prev,
                              content: event.target.value,
                            }))
                          }
                          rows={3}
                          placeholder="记录要点、语法现象、个人理解等"
                          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                        />
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={submitNoteForm}
                          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400"
                        >
                          保存笔记
                        </button>
                        <button
                          type="button"
                          onClick={cancelNoteForm}
                          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {activeNotes.length ? (
                      activeNotes.map((note) => (
                        <div
                          key={note.id}
                          onMouseEnter={() =>
                            setHoverState({
                              blockIndex: note.block_index,
                              order: note.order,
                            })
                          }
                          onMouseLeave={() => setHoverState(null)}
                          className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-100 transition hover:border-emerald-500/40"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-emerald-200">
                                {note.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                行号 #{note.order} · 更新于{' '}
                                {new Date(note.updatedAt).toLocaleString()}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                removeNote(note.block_index, note.id)
                              }
                              className="text-xs text-slate-500 transition hover:text-red-400"
                            >
                              删除
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-slate-200">
                            {note.content}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">
                        暂无笔记。悬停字幕行并点击“添加笔记”即可创建笔记。
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
                选择左侧的情景模块，可查看对应的语境与聚焦提示。
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-900 bg-slate-900/40 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-emerald-300">情景分块导入导出</h2>
              <p className="text-xs text-slate-500">
                支持将 AI 生成的情景分块保存为 JSON，或从已有 JSON 恢复，避免重复调用模型。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <button
                type="button"
                onClick={handleScenarioExport}
                className="rounded-md border border-emerald-500/40 px-3 py-2 font-medium text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                disabled={scenarioExporting || !segmentation}
              >
                {scenarioExporting ? '导出中...' : '导出情景分块 JSON'}
              </button>
              <label className="inline-flex cursor-pointer flex-col items-start gap-1 text-slate-300">
                <span>{scenarioImporting ? '导入中...' : '导入情景分块 JSON'}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      handleScenarioImport(file);
                      event.target.value = '';
                    }
                  }}
                  disabled={scenarioImporting}
                  className="text-xs text-slate-400"
                />
              </label>
            </div>
          </div>
          {scenarioExportError ? (
            <p className="mt-3 text-xs text-red-400">! {scenarioExportError}</p>
          ) : null}
          {scenarioImportError ? (
            <p className="mt-1 text-xs text-red-400">! {scenarioImportError}</p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            导入新的情景分块会清空当前的学习分析与笔记，请先导出需要保留的内容。
          </p>
        </section>
        <section className="rounded-2xl border border-slate-900 bg-slate-900/40 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-emerald-300">
                笔记导入导出
              </h2>
              <p className="text-xs text-slate-500">
                支持将情景、学习分析与笔记导出为 Markdown，并可从 Markdown
                导入笔记与分析结果。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <button
                type="button"
                onClick={handleExport}
                className="rounded-md border border-emerald-500/40 px-3 py-2 font-medium text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                disabled={exporting || !segmentation}
              >
                {exporting ? '导出中...' : '导出 Markdown'}
              </button>
              <label className="inline-flex cursor-pointer flex-col items-start gap-1 text-slate-300">
                <span>导入 Markdown</span>
                <input
                  type="file"
                  accept=".md,.markdown"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      handleImport(file);
                      event.target.value = '';
                    }
                  }}
                  className="text-xs text-slate-400"
                />
              </label>
            </div>
          </div>
          {exportError ? (
            <p className="mt-3 text-xs text-red-400">⚠ {exportError}</p>
          ) : null}
          {importError ? (
            <p className="mt-1 text-xs text-red-400">⚠ {importError}</p>
          ) : null}
          {!hasNotes ? (
            <p className="mt-2 text-xs text-slate-500">
              当前未创建笔记。导出文件会包含分块信息和已有的学习分析。
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-900 bg-slate-900/40 p-6 text-xs text-slate-500">
          <p>
            提示：已支持字幕分块与单模块学习分析（Spike5）。后续阶段将引入批量分析、
            笔记管理以及 Markdown 导入导出功能。
          </p>
        </section>
      <SettingsDrawer />
      </div>
    </main>
  );
}







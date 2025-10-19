import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generateTextMock = vi.fn();
const chatMock = vi.fn(() => 'mock-chat-handle');
const createOpenAIMock = vi.fn(() => ({ chat: chatMock }));

vi.mock('ai', () => ({
  generateText: generateTextMock,
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: createOpenAIMock,
}));

const ORIGINAL_ENV = { ...process.env };

const sampleBlock = {
  block_index: 1,
  block_name: '测试模块',
  synopsis: '示例概要',
  start_line: 1,
  end_line: 3,
  dialogues: [
    {
      order: 1,
      speaker: 'Alice',
      text: 'We should regroup and plan carefully.',
    },
    {
      order: 2,
      speaker: 'Bob',
      text: 'Agreed, surprise will be crucial for success.',
    },
  ],
};

const mockStructuredResponse = {
  block_index: 1,
  block_name: '测试模块',
  modules: {
    vocabulary: {
      focus_exams: ['CET-4'],
      core: [
        {
          term: 'defiance',
          phonetic: 'dɪˈfaɪəns',
          meaning_cn: '反抗；蔑视',
          exam_tags: ['CET-6', 'IELTS'],
          subtitle_example: {
            sentence: 'Their defiance inspired the rest of the team.',
            translation: '他们的反抗激励了团队其他成员。',
          },
          exam_example: {
            sentence: 'His open defiance of the rule caused serious consequences.',
            translation: '他公然违抗规则，造成严重后果。',
          },
        },
      ],
      phrases: [],
      extension: [],
    },
    grammar: {
      sentence_breakdown: ['All intelligence indicates | that clause'],
      grammar_points: [
        {
          title: '非限制性定语从句',
          explanation: 'which 引导的非限制性定语从句可以指代前面整个句子。',
          structure: '..., which + 结果/解释',
          examples: [
            {
              sentence: 'It might snow tomorrow, which means the road will be dangerous.',
            },
          ],
          exam_focus: '写作时可用来增加句式多样性',
        },
      ],
      application: ['在写作中可用 which 引导的从句对前文观点进行补充说明。'],
    },
    listening_pronunciation: {
      keyword_pronunciations: [
        {
          term: 'regroup',
          ipa: 'rɪˈgruːp',
          tip: '注意重音在第二音节。',
        },
      ],
      connected_speech: [],
      listening_strategies: ['关注功能词弱读，提取核心信息。'],
    },
    culture_context: {
      slang_or_register: [],
      cultural_notes: ['会议语境中“surprise”强调突袭策略的重要性。'],
      pragmatic_functions: ['表达策略讨论与资源协调。'],
    },
    practice: {
      comprehension_checks: [
        {
          question: '会议讨论的关键策略是什么？',
          answer: '保持突袭性并谨慎规划。',
          explanation: '对话中指出“surprise will be crucial for success”。',
        },
      ],
      rewriting_tasks: [
        {
          instruction: '使用 “defiance” 改写一句描述抵抗的句子。',
          reference: 'Their defiance shocked the authorities.',
          target_words: ['defiance'],
        },
      ],
      speaking_prompts: ['你认为会议中如何保持高效沟通以保证突袭计划成功？'],
    },
  },
  summary_markdown: '## Module 1 · 词汇与短语\n- defiance：反抗；蔑视',
};

describe('analyzeScenarioBlocks', () => {
  beforeEach(() => {
    vi.resetModules();
    generateTextMock.mockReset();
    chatMock.mockReset();
    createOpenAIMock.mockClear();
    Object.assign(process.env, ORIGINAL_ENV);
  });

  afterEach(() => {
    generateTextMock.mockReset();
    chatMock.mockReset();
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it('returns structured analysis when model响应合法 JSON', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify(mockStructuredResponse),
    });

    const { analyzeScenarioBlocks } = await import('../scenario-analysis');
    const result = await analyzeScenarioBlocks({
      subtitle_title: 'Test Subtitle',
      blocks: [sampleBlock],
      config: { examTargets: ['CET-4'] },
    });

    expect(createOpenAIMock).toHaveBeenCalledTimes(1);
    expect(chatMock).toHaveBeenCalled();
    expect(generateTextMock).toHaveBeenCalled();

    expect(result).toHaveLength(1);
    const blockAnalysis = result[0];
    expect(blockAnalysis.block_index).toBe(1);
    expect(blockAnalysis.structured.vocabulary.core[0]?.term).toBe('defiance');
    expect(blockAnalysis.structured.grammar.grammar_points[0]?.title).toMatch(/定语从句/);
    expect(blockAnalysis.markdown).toContain('Module 1');
  });

  it('throws when模型输出不可解析', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    generateTextMock.mockResolvedValueOnce({
      text: 'not-json',
    });

    const { analyzeScenarioBlocks } = await import('../scenario-analysis');

    await expect(
      analyzeScenarioBlocks({
        subtitle_title: 'Invalid',
        blocks: [sampleBlock],
      })
    ).rejects.toThrow(/无法解析/);
  });
});

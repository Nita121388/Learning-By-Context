import { afterEach, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

const sampleSubtitle = [
  '1',
  '00:00:01 --> 00:00:03',
  'Rick: Hello there.',
  '',
  '2',
  '00:00:03 --> 00:00:05',
  'Beth: Hi!',
  '',
].join('\n');

const mockSegmentationResponse = {
  subtitle_title: '会议日志',
  segmentation_strategy: '按场景转换分段',
  total_blocks: 2,
  blocks: [
    {
      block_index: 1,
      block_name: '会议开场',
      synopsis: '反抗联盟会议正式开始，成员互相问候。',
      start_line: 1,
      end_line: 2,
      context_tags: ['会议', '问候'],
      exam_alignment: ['CET-4'],
      difficulty: '进阶',
      learning_focus: {
        vocabulary: 'Hello there; Hi',
        grammar: '问候语句型',
        listening: '多人开场对白识别',
      },
      dialogues: [
        {
          order: 1,
          speaker: 'Rick',
          text: 'Hello there.',
          emotion: '平静',
        },
        {
          order: 2,
          speaker: 'Beth',
          text: 'Hi!',
          emotion: '热情',
        },
      ],
      follow_up_tasks: ['练习问候语表达'],
    },
  ],
};

async function importService() {
  return await import('../subtitle-segmentation');
}

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
});

afterAll(() => {
  Object.assign(process.env, ORIGINAL_ENV);
});

describe('segmentSubtitle', () => {
  it('returns normalized scenario segmentation result', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'mock-model';

    generateTextMock.mockResolvedValueOnce({
      text: JSON.stringify(mockSegmentationResponse),
    });

    const { segmentSubtitle } = await importService();
    const result = await segmentSubtitle({
      subtitle: sampleSubtitle,
      title: '自定义标题',
    });

    expect(createOpenAIMock).toHaveBeenCalledTimes(1);
    expect(chatMock).toHaveBeenCalledWith('mock-model');
    expect(generateTextMock).toHaveBeenCalledTimes(1);

    const callPayload = generateTextMock.mock.calls[0]?.[0];
    expect(callPayload?.prompt).toContain('1. [00:00:01 --> 00:00:03] Rick: Hello there.');
    expect(callPayload?.prompt).toContain('2. [00:00:03 --> 00:00:05] Beth: Hi!');

    expect(result.subtitle_title).toBe('会议日志');
    expect(result.total_blocks).toBe(1);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.block_name).toBe('会议开场');
    expect(result.blocks[0]?.dialogues[0]?.text).toBe('Hello there.');
  });

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;

    const { segmentSubtitle } = await importService();

    await expect(
      segmentSubtitle({
        subtitle: sampleSubtitle,
      }),
    ).rejects.toThrow('缺少 OPENAI_API_KEY 配置，无法执行情景分块。');

    expect(generateTextMock).not.toHaveBeenCalled();
  });
});

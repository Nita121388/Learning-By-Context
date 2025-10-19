import { describe, expect, it } from 'vitest';

import type { ScenarioSegmentation } from '../../../schema';
import {
  deserializeScenarioSegmentation,
  normalizeScenarioSegmentation,
  safeParseScenarioSegmentation,
  serializeScenarioSegmentation,
} from '../scenario-io';

const messyScenario: ScenarioSegmentation = {
  subtitle_title: '测试字幕',
  segmentation_strategy: '按话题聚类',
  total_blocks: 5,
  blocks: [
    {
      block_index: 2,
      block_name: '总结阶段',
      synopsis: '团队成员回顾要点并安排后续任务。',
      start_line: 11,
      end_line: 18,
      context_tags: ['复盘', '任务安排'],
      dialogues: [
        {
          order: 18,
          speaker: 'Lee',
          text: 'We should send the follow up email tomorrow.',
        },
        {
          order: 17,
          speaker: 'Kim',
          text: 'Great, let us capture the key decisions first.',
        },
        {
          order: 19,
          speaker: 'Lee',
          text: '   ',
        },
      ],
    },
    {
      block_index: 1,
      block_name: '讨论开始',
      synopsis: '主持人抛出讨论主题，成员依次表达观点。',
      start_line: 1,
      end_line: 10,
      dialogues: [
        {
          order: 3,
          speaker: 'Alex',
          text: 'I believe we should reconsider the launch timeline.',
        },
        {
          order: 1,
          speaker: 'Moderator',
          text: 'Thank you all for joining, today we focus on the launch plan.',
        },
        {
          order: 2,
          speaker: 'Sam',
          text: 'The marketing assets need another review pass.',
        },
      ],
    },
  ],
};

describe('scenario-io helpers', () => {
  it('规范化情景分块顺序并补正统计信息', () => {
    const normalized = normalizeScenarioSegmentation(messyScenario);

    expect(normalized.total_blocks).toBe(2);
    expect(normalized.blocks.map((block) => block.block_index)).toEqual([1, 2]);
    expect(normalized.blocks[0]?.dialogues.map((dialogue) => dialogue.order)).toEqual([1, 2, 3]);
    expect(normalized.blocks[1]?.dialogues.map((dialogue) => dialogue.order)).toEqual([17, 18]);
  });

  it('序列化与反序列化保持数据一致', () => {
    const normalized = normalizeScenarioSegmentation(messyScenario);
    const payload = serializeScenarioSegmentation(normalized);
    const restored = deserializeScenarioSegmentation(payload);

    expect(restored).toEqual(normalized);
  });

  it('安全解析成功时返回规范化结果，失败时得到 undefined', () => {
    const valid = safeParseScenarioSegmentation(messyScenario);
    expect(valid).toBeDefined();
    expect(valid?.total_blocks).toBe(2);

    const invalid = safeParseScenarioSegmentation({ foo: 'bar' });
    expect(invalid).toBeUndefined();
  });
});

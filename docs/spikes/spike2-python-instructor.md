# Spike 2：Python Instructor + Pydantic 结构化输出

## 目的
在后端异步任务（队列 Worker）场景，用 Instructor 将模型输出直接映射到 Pydantic 对象，验证类型约束的可行性与鲁棒性。

## 前置
- Python 3.10+
- 依赖：`pip install instructor openai pydantic`
- 环境变量：`OPENAI_API_KEY`、`OPENAI_BASE_URL`（可选）、`OPENAI_MODEL`（可选）

## 目标结构
```py
from pydantic import BaseModel

class GlossaryItem(BaseModel):
    word: str
    pos: str
    meaning_cn: str
    example: str | None = None

class Glossary(BaseModel):
    items: list[GlossaryItem]
```

## 最小示例
```py
# 路径：spikes/spike2-python-instructor/spike2.py
from __future__ import annotations

import os

import instructor
from openai import OpenAI
from pydantic import BaseModel


class GlossaryItem(BaseModel):
    word: str
    pos: str
    meaning_cn: str
    example: str | None = None


class Glossary(BaseModel):
    items: list[GlossaryItem]


def run(subtitle: str) -> Glossary:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("请先配置 OPENAI_API_KEY。")

    base_url = os.environ.get("OPENAI_BASE_URL")
    model_name = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    client = instructor.from_openai(OpenAI(api_key=api_key, base_url=base_url))
    result: Glossary = client.chat.completions.create(
        model=model_name,
        response_model=Glossary,
        messages=[
            {
                "role": "user",
                "content": (
                    "从以下英文字幕中抽取 8 个词/短语并返回 JSON：\n\n"
                    f"{subtitle}\n\n"
                    "字段：word/pos/meaning_cn/example(可选)。"
                ),
            }
        ],
        max_retries=2,
    )
    return result


if __name__ == "__main__":
    glossary = run("I thought we had an agreement. This is not what we discussed.")
    print(glossary.model_dump_json(indent=2, ensure_ascii=False))
```

## 运行
```bash
cd spikes/spike2-python-instructor
python spike2.py
```

## 观察指标
- Pydantic 校验失败率、重试次数、平均/尾延迟
- 与 TS 侧（Spike 1）对比：产出质量、易用性与部署便利
- 作为 Worker 的可移植性：依赖体积、容器镜像大小、冷启动时间

## 结论记录（占位）
- 校验失败率：__%
- 平均延迟：__s；P95：__s
- 是否适合作为“严谨路径”（备用/主路径）：____

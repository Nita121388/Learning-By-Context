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
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("请先在环境变量中设置 OPENAI_API_KEY。")

    base_url = os.getenv("OPENAI_BASE_URL")
    model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

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
    subtitle_text = "I thought we had an agreement. This is not what we discussed."
    glossary = run(subtitle_text)
    print(glossary.model_dump_json(indent=2, ensure_ascii=False))

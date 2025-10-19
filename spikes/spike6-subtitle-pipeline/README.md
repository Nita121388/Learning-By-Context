# spike6：视频字幕提取管线探索

本实验聚焦“先 A 后 B”的策略：  
- 方案 A：优先检测并导出视频内置字幕轨；  
- 方案 B：当视频缺失字幕轨时，回退到音频转写生成字幕。

## 准备条件

- 安装 [FFmpeg](https://ffmpeg.org/)，并确保 `ffmpeg` 与 `ffprobe` 命令可在终端直接调用。  
- Node.js 18+。脚本通过 `tsx` 运行，更易调试 TypeScript 原型。

## 方案 A：导出内置字幕轨

执行入口：`extract-embedded-subtitles.ts`

```bash
npx tsx spikes/spike6-subtitle-pipeline/extract-embedded-subtitles.ts ./sample.mp4 ./sample.srt
```

行为说明：

1. 使用 `ffprobe` 枚举字幕流，优先选择第一个字幕轨。  
2. 自动推断输出路径（默认与输入视频同目录、后缀为 `.srt`）。  
3. 若存在字幕轨，调用 `ffmpeg -map 0:s:<index>` 导出 SRT。  
4. 若无字幕轨，返回对应提示，以便后续触发方案 B。

## 方案 B：音频转写生成字幕

执行入口：`transcribe-to-subtitles.ts`

```bash
OPENAI_API_KEY=sk-xxx npx tsx spikes/spike6-subtitle-pipeline/transcribe-to-subtitles.ts ./sample.mp4 ./sample-whisper.srt gpt-4o-mini-transcribe
```

流程要点：

1. 使用 `ffmpeg` 抽取单声道 16 kHz WAV 音频。  
2. 调用 OpenAI Whisper 系列模型（默认 `gpt-4o-mini-transcribe`，可通过第三个参数或 `WHISPER_MODEL` 环境变量覆盖）。  
3. 将 `verbose_json` 响应中的 `segments` 转换为标准 SRT；若返回仅包含纯文本，则降级为单段字幕。  
4. 生成结束后自动清理临时音频文件。

使用建议：

- 长视频建议在上游拆分音频，再对每段执行脚本并拼合结果；  
- 嘈杂环境可在提取音频时追加滤波选项（示例：`-af "loudnorm,highpass=f=200,lowpass=f=3000"`）；  
- 如需本地离线转写，可将脚本中调用 OpenAI 的部分替换成 `whisper.cpp` 或其他离线 ASR CLI。

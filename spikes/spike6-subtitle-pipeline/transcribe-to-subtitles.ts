import { spawn } from "child_process";
import { createReadStream, constants as fsConstants } from "fs";
import { promises as fsp } from "fs";
import { basename, dirname, extname, join, resolve } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import OpenAI from "openai";

interface WhisperSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg) {
    console.error(
      "用法: tsx transcribe-to-subtitles.ts <视频路径> [输出文件] [模型名]"
    );
    process.exitCode = 1;
    return;
  }

  const inputPath = resolve(inputArg);
  await ensureReadable(inputPath);

  const outputPath =
    outputArg !== undefined
      ? resolve(outputArg)
      : join(dirname(inputPath), `${basename(inputPath, extname(inputPath))}.srt`);

  const model = process.argv[5] ?? process.env.WHISPER_MODEL ?? "gpt-4o-mini-transcribe";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("缺少 OPENAI_API_KEY，无法执行方案 B。");
    process.exitCode = 2;
    return;
  }

  const tempAudioPath = join(tmpdir(), `subtitle-audio-${randomUUID()}.wav`);

  try {
    console.log("正在提取音频轨...");
    await extractMonoAudio(inputPath, tempAudioPath);

    console.log(`已生成临时音频: ${tempAudioPath}`);
    const client = new OpenAI({ apiKey });

    console.log(`调用模型 ${model} 进行转写...`);
    const transcription = await client.audio.transcriptions.create({
      file: createReadStream(tempAudioPath),
      model,
      response_format: "verbose_json",
      temperature: 0,
    });

    const segments = (transcription.segments ?? []) as WhisperSegment[];
    const srt = segments.length
      ? renderSegmentsAsSrt(segments)
      : renderFallbackSrt(transcription.text ?? "");

    await fsp.writeFile(outputPath, srt, "utf8");
    console.log(`字幕生成完成，输出路径: ${outputPath}`);
  } catch (error) {
    console.error("音频转写流程失败: ", error);
    process.exitCode = 3;
  } finally {
    await safeUnlink(tempAudioPath);
  }
}

async function ensureReadable(path: string) {
  try {
    await fsp.access(path, fsConstants.R_OK);
  } catch {
    throw new Error(`无法读取输入文件: ${path}`);
  }
}

async function extractMonoAudio(inputPath: string, targetPath: string) {
  const args = [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-f",
    "wav",
    targetPath,
  ];
  await runCommand("ffmpeg", args);
}

function renderSegmentsAsSrt(segments: WhisperSegment[]) {
  return segments
    .map((segment, index) => {
      const id = (segment.id ?? index) + 1;
      const start = formatSrtTimestamp(segment.start);
      const end = formatSrtTimestamp(segment.end);
      return `${id}\n${start} --> ${end}\n${segment.text.trim()}\n`;
    })
    .join("\n");
}

function renderFallbackSrt(text: string) {
  return `1\n00:00:00,000 --> 00:59:59,000\n${text.trim()}\n`;
}

function formatSrtTimestamp(seconds: number) {
  const totalMillis = Math.max(0, Math.floor(seconds * 1000));
  const millis = totalMillis % 1000;
  const totalSeconds = Math.floor(totalMillis / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return `${pad(h)}:${pad(m)}:${pad(s)},${padMillis(millis)}`;
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function padMillis(value: number) {
  return value.toString().padStart(3, "0");
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} 执行失败，退出码 ${code}`));
      }
    });
  });
}

async function safeUnlink(path: string) {
  try {
    await fsp.unlink(path);
  } catch {
    // 忽略临时文件删除失败
  }
}

void main();

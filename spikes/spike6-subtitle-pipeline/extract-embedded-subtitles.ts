import { spawn } from "child_process";
import { access, constants } from "fs";
import { promisify } from "util";
import { basename, dirname, extname, join, resolve } from "path";

const accessAsync = promisify(access);

interface SubtitleStream {
  index: number;
  codec_name?: string;
  codec_type?: string;
  tags?: {
    language?: string;
    title?: string;
  };
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg) {
    console.error("用法: tsx extract-embedded-subtitles.ts <视频路径> [输出文件]");
    process.exitCode = 1;
    return;
  }

  const inputPath = resolve(inputArg);
  await ensureFileAccessible(inputPath);

  const outputPath =
    outputArg !== undefined
      ? resolve(outputArg)
      : buildDefaultOutputPath(inputPath);

  try {
    const streams = await detectSubtitleStreams(inputPath);
    if (!streams.length) {
      console.error("未检测到内置字幕轨, 无法执行方案 A.");
      process.exitCode = 2;
      return;
    }

    const targetStream = streams[0];
    console.log(
      `发现字幕轨 index=${targetStream.index}, codec=${targetStream.codec_name ?? "未知"}, language=${targetStream.tags?.language ?? "未标注"}`
    );

    await extractSubtitleStream(inputPath, outputPath, targetStream.index);
    console.log(`字幕提取完成, 输出路径: ${outputPath}`);
  } catch (error) {
    console.error("字幕提取失败: ", error);
    process.exitCode = 3;
  }
}

async function ensureFileAccessible(path: string) {
  try {
    await accessAsync(path, constants.R_OK);
  } catch {
    throw new Error(`无法读取输入文件: ${path}`);
  }
}

function buildDefaultOutputPath(inputPath: string) {
  const base = basename(inputPath, extname(inputPath));
  return join(dirname(inputPath), `${base}.srt`);
}

async function detectSubtitleStreams(videoPath: string): Promise<SubtitleStream[]> {
  const args = [
    "-v",
    "error",
    "-select_streams",
    "s",
    "-show_entries",
    "stream=index,codec_name,codec_type:stream_tags=language,title",
    "-of",
    "json",
    videoPath,
  ];
  const { stdout } = await runCommand("ffprobe", args);
  const parsed = JSON.parse(stdout) as { streams?: SubtitleStream[] };
  return (parsed.streams ?? []).filter((stream) => stream.codec_type === "subtitle");
}

async function extractSubtitleStream(
  videoPath: string,
  outputPath: string,
  streamIndex: number
) {
  const args = [
    "-y",
    "-i",
    videoPath,
    "-map",
    `0:s:${streamIndex}`,
    outputPath,
  ];
  await runCommand("ffmpeg", args);
}

function runCommand(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} 执行失败, 退出码 ${code}, 输出: ${stderr || stdout}`));
      }
    });
  });
}

void main();

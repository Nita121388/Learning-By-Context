'use client';

import { useState } from "react";
import { EXAM_TARGET_OPTIONS, MODEL_PRESETS, useSettings } from "../hooks/use-settings";

export function SettingsDrawer() {
  const {
    state,
    setModel,
    setTemperature,
    setMaxTokens,
    setCacheTTL,
    setTemplate,
    setExamTargets,
    resetSettings,
  } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full border border-emerald-500/40 bg-slate-900/80 px-4 py-2 text-sm font-medium text-emerald-100 shadow-lg shadow-emerald-500/10 transition hover:border-emerald-400 hover:bg-slate-900"
      >
        {open ? "关闭设置" : "打开设置"}
      </button>
      {open ? (
        <div className="mt-4 w-72 space-y-4 rounded-2xl border border-slate-800 bg-slate-950/95 p-5 text-xs text-slate-200 shadow-xl shadow-slate-900/50 backdrop-blur">
          <header className="space-y-1">
            <h2 className="text-sm font-semibold text-emerald-300">系统配置</h2>
            <p className="text-[11px] text-slate-500">
              调整模型、温度、缓存策略与导出模板，配置会保存在浏览器本地。
            </p>
          </header>

          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">模型选择</span>
              <select
                value={state.model}
                onChange={(event) => setModel(event.target.value as Parameters<typeof setModel>[0])}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              >
                {MODEL_PRESETS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">温度（0-2）</span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={state.temperature}
                onChange={(event) => setTemperature(Number(event.target.value))}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">最大 Tokens（256-8192）</span>
              <input
                type="number"
                min={256}
                max={8192}
                step={256}
                value={state.maxTokens}
                onChange={(event) => setMaxTokens(Number(event.target.value))}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">学习分析缓存时长（分钟）</span>
              <input
                type="number"
                min={5}
                max={720}
                step={5}
                value={state.analysisCacheTTL}
                onChange={(event) => setCacheTTL(Number(event.target.value))}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] text-slate-400">导出模板</span>
              <select
                value={state.exportTemplate}
                onChange={(event) => setTemplate(event.target.value as "standard" | "concise")}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              >
                <option value="standard">标准模板（含完整分析与笔记）</option>
                <option value="concise">精简模板（仅保留要点）</option>
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-[11px] text-slate-400">重点考试范围</legend>
              <div className="flex flex-wrap gap-2">
                {EXAM_TARGET_OPTIONS.map((target) => {
                  const checked = state.examTargets.includes(target);
                  return (
                    <label
                      key={target}
                      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${
                        checked
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                          : "border-slate-700 text-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-emerald-400"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? state.examTargets.filter((item) => item !== target)
                            : [...state.examTargets, target];
                          setExamTargets(next);
                        }}
                      />
                      <span>{target}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-500">
                勾选后，学习分析将优先覆盖对应考试的高频词汇与能力点。
              </p>
            </fieldset>
          </div>

          <footer className="flex items-center justify-between text-[11px] text-slate-500">
            <span>设置会自动保存。</span>
            <button
              type="button"
              onClick={resetSettings}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            >
              恢复默认
            </button>
          </footer>
        </div>
      ) : null}
    </div>
  );
}

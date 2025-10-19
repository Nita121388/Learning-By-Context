'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";

export const MODEL_PRESETS = [
  "deepseek-chat",
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
] as const;

export const EXAM_TARGET_OPTIONS = [
  "CET-4",
  "CET-6",
  "IELTS",
  "TOEFL",
  "考研英语",
] as const;

type ModelPreset = (typeof MODEL_PRESETS)[number];
type ExamTarget = (typeof EXAM_TARGET_OPTIONS)[number];

interface SettingsState {
  model: ModelPreset;
  temperature: number;
  maxTokens: number;
  analysisCacheTTL: number;
  exportTemplate: "standard" | "concise";
  examTargets: ExamTarget[];
}

type SettingsAction =
  | { type: "set-model"; payload: ModelPreset }
  | { type: "set-temperature"; payload: number }
  | { type: "set-maxTokens"; payload: number }
  | { type: "set-cache-ttl"; payload: number }
  | { type: "set-template"; payload: "standard" | "concise" }
  | { type: "set-exam-targets"; payload: ExamTarget[] }
  | { type: "reset"; payload?: SettingsState };

function isModelPreset(value: unknown): value is ModelPreset {
  return typeof value === "string" && MODEL_PRESETS.includes(value as ModelPreset);
}

function isExamTarget(value: unknown): value is ExamTarget {
  return typeof value === "string" && EXAM_TARGET_OPTIONS.includes(value as ExamTarget);
}

const envDefaultModel = process.env.NEXT_PUBLIC_DEFAULT_MODEL;
if (envDefaultModel && !isModelPreset(envDefaultModel)) {
  console.warn("检测到未支持的默认模型，已回退至 deepseek-chat：", envDefaultModel);
}

const DEFAULT_MODEL: ModelPreset =
  envDefaultModel && isModelPreset(envDefaultModel) ? envDefaultModel : MODEL_PRESETS[0];

const DEFAULT_SETTINGS: SettingsState = {
  model: DEFAULT_MODEL,
  temperature: 0.3,
  maxTokens: 2048,
  analysisCacheTTL: 60,
  exportTemplate: "standard",
  examTargets: [...EXAM_TARGET_OPTIONS.slice(0, 4)],
};

const STORAGE_KEY = "subtitle-tutor-settings";

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case "set-model":
      return { ...state, model: action.payload };
    case "set-temperature":
      return { ...state, temperature: clamp(action.payload, 0, 2) };
    case "set-maxTokens":
      return { ...state, maxTokens: clamp(action.payload, 256, 8192) };
    case "set-cache-ttl":
      return { ...state, analysisCacheTTL: clamp(action.payload, 5, 720) };
    case "set-template":
      return { ...state, exportTemplate: action.payload };
    case "set-exam-targets": {
      const filtered = action.payload.filter(isExamTarget);
      return { ...state, examTargets: filtered.length ? filtered : DEFAULT_SETTINGS.examTargets };
    }
    case "reset":
      return action.payload ?? DEFAULT_SETTINGS;
    default:
      return state;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

interface SettingsContextValue {
  state: SettingsState;
  setModel: (model: ModelPreset) => void;
  setTemperature: (value: number) => void;
  setMaxTokens: (value: number) => void;
  setCacheTTL: (value: number) => void;
  setTemplate: (template: "standard" | "concise") => void;
  setExamTargets: (targets: ExamTarget[]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(
    settingsReducer,
    DEFAULT_SETTINGS,
    (initial) => {
      if (typeof window === "undefined") {
        return initial;
      }
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return initial;
        }
        const parsed = JSON.parse(raw) as Partial<SettingsState>;
        const storedModel =
          typeof parsed.model === "string" && isModelPreset(parsed.model)
            ? parsed.model
            : initial.model;
        const storedExamTargets =
          Array.isArray(parsed.examTargets) && parsed.examTargets.length
            ? parsed.examTargets.filter(isExamTarget)
            : undefined;
        const next = {
          temperature:
            typeof parsed.temperature === "number"
              ? clamp(parsed.temperature, 0, 2)
              : initial.temperature,
          maxTokens:
            typeof parsed.maxTokens === "number"
              ? clamp(parsed.maxTokens, 256, 8192)
              : initial.maxTokens,
          analysisCacheTTL:
            typeof parsed.analysisCacheTTL === "number"
              ? clamp(parsed.analysisCacheTTL, 5, 720)
              : initial.analysisCacheTTL,
          exportTemplate: parsed.exportTemplate ?? initial.exportTemplate,
          examTargets:
            storedExamTargets && storedExamTargets.length
              ? storedExamTargets
              : initial.examTargets,
        };
        return {
          ...next,
          model: storedModel,
        };
      } catch (error) {
        console.warn("读取设置失败，使用默认配置：", error);
        return initial;
      }
    }
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("写入设置失败：", error);
    }
  }, [state]);

  const setModel = useCallback((model: ModelPreset) => {
    if (!isModelPreset(model)) {
      console.warn("忽略未支持的模型配置：", model);
      return;
    }
    dispatch({ type: "set-model", payload: model });
  }, []);

  const setTemperature = useCallback((value: number) => {
    dispatch({ type: "set-temperature", payload: value });
  }, []);

  const setMaxTokens = useCallback((value: number) => {
    dispatch({ type: "set-maxTokens", payload: value });
  }, []);

  const setCacheTTL = useCallback((value: number) => {
    dispatch({ type: "set-cache-ttl", payload: value });
  }, []);

  const setTemplate = useCallback((template: "standard" | "concise") => {
    dispatch({ type: "set-template", payload: template });
  }, []);

  const setExamTargets = useCallback((targets: ExamTarget[]) => {
    dispatch({ type: "set-exam-targets", payload: targets });
  }, []);

  const resetSettings = useCallback(() => {
    dispatch({ type: "reset" });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      state,
      setModel,
      setTemperature,
      setMaxTokens,
      setCacheTTL,
      setTemplate,
      setExamTargets,
      resetSettings,
    }),
    [state, setModel, setTemperature, setMaxTokens, setCacheTTL, setTemplate, setExamTargets, resetSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings 必须在 SettingsProvider 内使用。");
  }
  return context;
}

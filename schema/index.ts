export interface SubtitleLine {
  order: number;
  text: string;
  speaker?: string;
  timestamp?: string;
  emotion?: string;
}

export interface ScenarioBlock {
  block_index: number;
  block_name: string;
  synopsis: string;
  start_line: number;
  end_line: number;
  context_tags?: string[];
  exam_alignment?: string[];
  difficulty?: string;
  learning_focus?: {
    vocabulary?: string;
    grammar?: string;
    listening?: string;
    culture?: string;
  };
  dialogues: SubtitleLine[];
  follow_up_tasks?: string[];
}

export interface ScenarioSegmentation {
  subtitle_title: string;
  segmentation_strategy: string;
  total_blocks: number;
  blocks: ScenarioBlock[];
}

export interface LearningModule {
  block_index: number;
  markdown: string;
}

export interface NoteItem {
  id: string;
  block_index: number;
  order: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisExample {
  sentence: string;
  translation?: string;
}

export interface AnalysisVocabularyCore {
  term: string;
  phonetic?: string;
  part_of_speech?: string;
  meaning_cn?: string;
  meaning_en?: string;
  exam_tags?: string[];
  subtitle_example?: AnalysisExample;
  exam_example?: AnalysisExample;
  notes?: string;
}

export interface AnalysisVocabularyPhrase {
  phrase: string;
  meaning_cn?: string;
  meaning_en?: string;
  exam_tags?: string[];
  example?: AnalysisExample;
  usage_tip?: string;
}

export interface AnalysisVocabularyExtension {
  term: string;
  meaning_cn?: string;
  usage_tip?: string;
}

export interface AnalysisGrammarPoint {
  title: string;
  explanation?: string;
  structure?: string;
  examples?: AnalysisExample[];
  exam_focus?: string;
}

export interface AnalysisPronunciationEntry {
  term: string;
  ipa?: string;
  stress?: string;
  tip?: string;
}

export interface AnalysisConnectedSpeech {
  phenomenon: string;
  example?: string;
  explanation?: string;
}

export interface AnalysisSlangEntry {
  expression: string;
  meaning?: string;
  usage?: string;
  exam_warning?: string;
}

export interface AnalysisComprehensionCheck {
  question: string;
  answer?: string;
  explanation?: string;
}

export interface AnalysisRewritingTask {
  instruction: string;
  reference?: string;
  target_words?: string[];
}

export interface AnalysisVocabularyModule {
  focus_exams: string[];
  core: AnalysisVocabularyCore[];
  phrases: AnalysisVocabularyPhrase[];
  extension: AnalysisVocabularyExtension[];
}

export interface AnalysisGrammarModule {
  sentence_breakdown: string[];
  grammar_points: AnalysisGrammarPoint[];
  application: string[];
}

export interface AnalysisListeningModule {
  keyword_pronunciations: AnalysisPronunciationEntry[];
  connected_speech: AnalysisConnectedSpeech[];
  listening_strategies: string[];
}

export interface AnalysisCultureModule {
  slang_or_register: AnalysisSlangEntry[];
  cultural_notes: string[];
  pragmatic_functions: string[];
}

export interface AnalysisPracticeModule {
  comprehension_checks: AnalysisComprehensionCheck[];
  rewriting_tasks: AnalysisRewritingTask[];
  speaking_prompts: string[];
}

export interface AnalysisModules {
  vocabulary: AnalysisVocabularyModule;
  grammar: AnalysisGrammarModule;
  listening_pronunciation: AnalysisListeningModule;
  culture_context: AnalysisCultureModule;
  practice: AnalysisPracticeModule;
}

export interface LearningAnalysisBlock {
  block_index: number;
  block_name: string;
  structured: AnalysisModules;
  markdown: string;
}

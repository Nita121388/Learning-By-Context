export interface GlossaryItem {
  word: string;
  pos: string;
  meaning_cn: string;
  example?: string;
}

export interface Glossary {
  items: GlossaryItem[];
}

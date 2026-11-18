import type * as THREE from 'three';
import type { AudioForge } from './audioForge';
import type { VfxForge } from './vfxForge';
import type { StudioStage } from './stage';

export type CategoryId =
  | 'fps'
  | 'melee'
  | 'racing'
  | 'platform'
  | 'loot'
  | 'world'
  | 'camera'
  | 'vfx'
  | 'audio';

export type Locale = 'zh' | 'en';

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface ParamDef {
  key: string;
  label: LocalizedText;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit?: string;
}

export interface TelemetryFrame {
  trauma: number;      // 0..1
  timeScale: number;   // 0..1.5
  fovOffset: number;   // -25..+35 deg
  intensity: number;   // 0..1 impulse gauge
}

export interface RecipeRuntimeContext {
  scene: THREE.Scene;
  group: THREE.Group;
  camera: THREE.PerspectiveCamera;
  stage: StudioStage;
  audio: AudioForge;
  vfx: VfxForge;
  getParams: () => Record<string, number>;
  isJuiceEnabled: () => boolean;
  emitCallout: (text: string, style?: 'gold' | 'crimson' | 'cyan' | 'emerald') => void;
  setHudStat: (label: string, value: string) => void;
}

export interface RecipeInstance {
  /** Trigger primary action (Space / Click / Trigger button) */
  trigger: (variant?: number) => void;
  /** Secondary action (e.g. Q quick-switch, Mikiri counter, Cut-drift) */
  secondary?: () => void;
  /** Per-frame update. rawDt is wall-clock delta; scaledDt includes hitstop/bullet-time */
  update: (rawDt: number, scaledDt: number, elapsed: number) => void;
  /** Clean up any custom resources not attached to ctx.group */
  dispose?: () => void;
}

export interface RecipeDefinition {
  id: string;
  category: CategoryId;
  badge: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  whyItMatters: LocalizedText;
  rawProblem: LocalizedText;
  controlsHint: LocalizedText;
  tags: string[];
  autoDemoInterval: number; // seconds between auto-demo triggers
  hasSecondary?: LocalizedText;
  params: ParamDef[];
  mount: (ctx: RecipeRuntimeContext) => RecipeInstance;
  /** Generates clean standalone copy-pasteable TypeScript code using current parameter values */
  generateCode: (params: Record<string, number>) => string;
  /** Ready-to-use Agent Skill prompt for Claude Code / Codex / Antigravity */
  agentPrompt: LocalizedText;
}

export interface CategoryMeta {
  id: CategoryId;
  icon: string;
  name: LocalizedText;
  tagline: LocalizedText;
}

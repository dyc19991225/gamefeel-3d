import type { CategoryId, CategoryMeta, RecipeDefinition } from '../core/types';
import { fpsRecipes } from './fps';
import { meleeRecipes } from './melee';
import { racingRecipes } from './racing';
import { platformRecipes } from './platform';
import { lootRecipes } from './loot';
import { worldRecipes } from './world';
import { cameraRecipes } from './camera';
import { vfxRecipes } from './vfx';
import { audioRecipes } from './audio';

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'fps',
    icon: '🎯',
    name: { zh: 'FPS 枪感与弹道', en: 'FPS Gunfeel' },
    tagline: { zh: '弹簧后坐、瞬狙 Q 切、穿箱衰减、爆头叮声', en: 'Spring recoil, quick-scope, wallbang & headshot ding' },
  },
  {
    id: 'melee',
    icon: '⚔️',
    name: { zh: '冷兵器拼刀与顿帧', en: 'Melee & Hitstop' },
    tagline: { zh: '只狼弹反火星、樱井非对称顿帧、刀光、忍杀', en: 'Deflect sparks, asymmetric hitstop, trails & deathblow' },
  },
  {
    id: 'racing',
    icon: '🏎️',
    name: { zh: '街机漂移与极速感', en: 'Drift & Speed' },
    tagline: { zh: '侧滑三阶胎火、CWW 氮气广角、断位、悬挂挤压', en: 'Slip-angle drift, CWW FOV warp, cut-drift & suspension' },
  },
  {
    id: 'platform',
    icon: '🕹️',
    name: { zh: '身法跳跃与残影跑酷', en: 'Platform & Parkour' },
    tagline: { zh: '土狼缓冲跳、全息冲刺残影、抓钩摆荡、飞檐斜镜', en: 'Coyote jump, hologram ghosts, grapple & wall-run tilt' },
  },
  {
    id: 'loot',
    icon: '💎',
    name: { zh: '刷宝爆装与肉鸽爽感', en: 'Loot & Roguelite' },
    tagline: { zh: '传奇橙光柱喷泉、反推磁吸经验潮、升级新星、开箱蓄力', en: 'Legendary sky-beam, push-back magnet, level nova & chest' },
  },
  {
    id: 'world',
    icon: '🌍',
    name: { zh: '物理碎裂、草水与震动', en: 'Destruction & World' },
    tagline: { zh: '27块实时爆碎、GPU压弯草海、干涉水面、手柄双震', en: '27-shard shatter, GPU grass bend, water ripples & haptics' },
  },
  {
    id: 'camera',
    icon: '🎥',
    name: { zh: '3D 镜头与时间操控', en: 'Camera & Time' },
    tagline: { zh: 'Trauma² 旋转震屏、魔女时间、暴击推镜、前瞻跟随', en: 'Trauma² shake, witch-time, zoom-punch & lookahead' },
  },
  {
    id: 'vfx',
    icon: '💥',
    name: { zh: '零贴图着色器与受击特效', en: 'Zero-Asset VFX' },
    tagline: { zh: '菲涅尔气浪、星芒枪焰抛壳、弹性跳字、两帧闪白', en: 'Fresnel blast, muzzle stars, pop numbers & hit-flash' },
  },
  {
    id: 'audio',
    icon: '🔊',
    name: { zh: '程序化声学锻造台', en: 'WebAudio Synth' },
    tagline: { zh: '零 MP3 合成枪炮、玉钢五泛音刀鸣、五挡引擎声浪', en: 'Zero-MP3 guns, Tamahagane steel partials & 5-gear RPM' },
  },
];

export const ALL_RECIPES: RecipeDefinition[] = [
  ...fpsRecipes,
  ...meleeRecipes,
  ...racingRecipes,
  ...platformRecipes,
  ...lootRecipes,
  ...worldRecipes,
  ...cameraRecipes,
  ...vfxRecipes,
  ...audioRecipes,
];

export function getRecipesByCategory(cat: CategoryId | 'all'): RecipeDefinition[] {
  if (cat === 'all') return ALL_RECIPES;
  return ALL_RECIPES.filter((r) => r.category === cat);
}

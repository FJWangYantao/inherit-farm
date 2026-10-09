// 所有内容表的索引：按 id 查定义，按种类列出能出现的条目。

import type { BuildingDef, CraftDef, JobDef, ResDef, ResId, ShelfDef, ShopItem, TabDef, TabId, TechDef } from '../defs';
import { ACTIONS, type ActionDef } from './actions';
import { BUILDINGS, CRAFTS, JOBS } from './buildings';
import { RESOURCES, TABS } from './resources';
import { SHELVES } from './shop';
import { TECHS } from './techs';

export { ACTIONS, BUILDINGS, CRAFTS, JOBS, RESOURCES, SHELVES, TABS, TECHS };
export type { ActionDef };

function index<T extends { id: string }>(list: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of list) {
    if (m.has(x.id)) throw new Error('重复的 id：' + x.id);
    m.set(x.id, x);
  }
  return m;
}

export const RES = index(RESOURCES) as Map<ResId, ResDef>;
export const TAB = index(TABS) as Map<TabId, TabDef>;
export const ACTION = index(ACTIONS);
export const BUILDING = index(BUILDINGS);
export const JOB = index(JOBS);
export const CRAFT = index(CRAFTS);
export const TECH = index(TECHS);
export const SHELF = index(SHELVES);

/** 货架上的每件东西在哪个货架、第几件 */
export const ITEM = new Map<string, { shelf: ShelfDef; index: number; item: ShopItem }>();
for (const shelf of SHELVES) {
  shelf.items.forEach((item, index) => {
    if (ITEM.has(item.id)) throw new Error('重复的 id：' + item.id);
    ITEM.set(item.id, { shelf, index, item });
  });
}

for (const t of TECHS) {
  for (const d of t.deps) if (!TECH.has(d)) throw new Error(`科技 ${t.id} 的前置 ${d} 不存在`);
}

export type EntryKind = 'res' | 'tab' | 'act' | 'b' | 'job' | 'craft' | 'tech' | 'shelf';

/** 页面上一个条目的 id 是「种类:id」，比如 b:tree、tech:grafting */
export function entryKind(entry: string): { kind: EntryKind; id: string } {
  const i = entry.indexOf(':');
  return { kind: entry.slice(0, i) as EntryKind, id: entry.slice(i + 1) };
}

/** 条目在哪一页，资源和页签本身不在任何一页里 */
export function entryTab(entry: string): TabId | undefined {
  const { kind, id } = entryKind(entry);
  switch (kind) {
    case 'act': return ACTION.get(id)?.tab;
    case 'b': return BUILDING.get(id)?.tab;
    case 'job': return 'crew';
    case 'craft': return 'craft';
    case 'tech': return 'study';
    case 'shelf': return SHELF.get(id)?.tab;
    default: return undefined;
  }
}

export type { BuildingDef, CraftDef, JobDef, ResDef, ShelfDef, ShopItem, TabDef, TechDef };

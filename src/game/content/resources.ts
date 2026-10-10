import type { ResDef, ResId, TabDef } from '../defs';

// 资源面板里的顺序按出现先后，这里的顺序不影响显示
export const RESOURCES: ResDef[] = [
  { id: 'fruit', name: '果子', show: () => true, cap: g => g.warehouse() },
  { id: 'wood', name: '木头', show: g => g.s.f.cap, cap: g => g.warehouse() },
  { id: 'money', name: '钱', show: g => g.s.f.sold, cap: () => Infinity },
  { id: 'science', name: '农技', show: g => g.isSeen('b:library'), cap: g => g.capOf('science') },
  { id: 'clay', name: '黏土', show: g => g.has('brickmaking'), cap: g => g.warehouse() / 2 },
  { id: 'plank', name: '木板', show: g => g.has('carpentry'), cap: g => g.warehouse() / 10 },
  { id: 'brick', name: '砖', show: g => g.has('brickmaking'), cap: g => g.warehouse() / 10 },
  { id: 'jam', name: '果酱', show: g => g.has('jam'), cap: g => g.warehouse() / 100 + g.capOf('jam') },
  { id: 'dried', name: '果干', show: g => g.has('drying'), cap: g => g.warehouse() / 50 + g.capOf('dried') },
  { id: 'juice', name: '果汁', show: g => g.has('juicing'), cap: g => g.warehouse() / 100 + g.capOf('juice') },
  { id: 'wine', name: '果酒', show: g => g.has('brewing'), cap: g => g.capOf('wine') },
  { id: 'fertilizer', name: '化肥', show: g => g.s.f.market, cap: g => g.warehouse() / 100 + g.capOf('fertilizer') },
  { id: 'guest', name: '游客', show: g => g.s.f.tourism, cap: g => g.capOf('guest') },
  { id: 'seedling', name: '良种苗木', show: g => g.s.made.includes('seedling') || g.has('nursery'), cap: g => 500 + g.capOf('seedling') }
];

export const RES_IDS = RESOURCES.map(r => r.id);

export function resName(id: ResId): string {
  return RESOURCES.find(r => r.id === id)!.name;
}

export const TABS: TabDef[] = [
  { id: 'farm', name: '农场', show: () => true },
  { id: 'market', name: '集市', show: g => g.s.f.sold },
  { id: 'crew', name: '帮工', show: g => g.isSeen('b:hut') },
  { id: 'study', name: '农技', show: g => g.isSeen('b:library') },
  { id: 'craft', name: '工坊', show: g => g.has('carpentry') || g.has('brickmaking') || g.has('jam') },
  { id: 'resort', name: '农家乐', show: g => g.s.f.tourism },
  { id: 'home', name: '家', show: g => g.isSeen('shelf:lux') }
];

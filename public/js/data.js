export const CARD_W = 1425
export const CARD_H = 2048

export const FACTIONS = ['wei', 'shu', 'wu', 'qun', 'jin']
export const FACTION_LABEL = { wei: '魏', shu: '蜀', wu: '吴', qun: '群', jin: '晋' }

export const MIN_HP = 0
export const MAX_HP = 10
export const MIN_SKILLS = 1
export const MAX_SKILLS = 3

export function defaultCard() {
  return {
    faction: 'shu',
    name: '貂蝉',
    title: '绝世的舞姬',
    hp: 3,
    skills: [
      { name: '离间', desc: '出牌阶段限一次，你可以弃置一张牌并选择两名男性角色，令其中一名男性角色视为对另一名男性角色使用一张【决斗】。' },
      { name: '闭月', desc: '结束阶段，你可以摸一张牌。' },
    ],
    image: null,
    imageSrc: null,
    layout: {
      name: { x: 116, y: 1010, scale: 1 },    // 竖排文字中心 x，顶部 y
      title: { x: 116, y: 470, scale: 1 },
      image: { x: CARD_W / 2, y: CARD_H / 2, scale: 1 },
    },
  }
}

export function coverTransform(img, w = CARD_W, h = CARD_H) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const scale = Math.max(w / iw, h / ih)
  return { x: w / 2, y: h / 2, scale }
}

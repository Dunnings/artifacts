export const ACTION = {
  Fight: 'fight',
  Move: 'move',
  Rest: 'rest',
  Gather: 'gathering',
  Craft: 'crafting',
  Unequip: 'unequip',
  Equip: 'equip',
} as const;

export const LOCATION = {
  AshTree: { x: -1, y: 0 },
  CraftingStation: { x: 2, y: 1 },
  Chickens: { x: 0, y: 1 },
  Cows: { x: 0, y: 2 },
  Wolves: { x: -2, y: 1 },
} as const;

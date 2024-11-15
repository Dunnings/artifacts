export const ACTION = {
  Fight: 'fight',
  Move: 'move',
  Rest: 'rest',
  Gather: 'gathering',
  Craft: 'crafting',
  Unequip: 'unequip',
  Equip: 'equip',
  Deposit: 'bank/deposit',
  Withdraw: 'bank/withdraw',
} as const;

export const LOCATION = {
  AshTree: { x: -1, y: 0 },
  Bank: { x: 4, y: 1 },
  WeaponCraftingStation: { x: 2, y: 1 },
  GearCraftingStation: { x: 3, y: 1 },
  WoodCuttingStation: { x: -2, y: -3 },
  Chickens: { x: 0, y: 1 },
  Cows: { x: 0, y: 2 },
  Wolves: { x: -2, y: 1 },
} as const;

export const ITEMCODE = {
  AshWood: 'ash_wood',
  AshPlank: 'ash_plank',
  WoodenStaff: 'wooden_staff',
  WoodenShield: 'wooden_shield',
};

export const EQUIPSLOT = {
  Weapon: 'weapon',
  Shield: 'shield',
};

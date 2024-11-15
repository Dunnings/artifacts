import { SKILL } from './enums';

export interface ICooldown {
  total_seconds: number;
  remaining_seconds: number;
  started_at: string;
  expiration: string;
  reason: string;
}

export interface IInventoryItem {
  slot: number;
  code: string;
  quantity: number;
}

export interface ICharacter {
  name: string;
  account: string;
  skin: string;
  level: number;
  xp: number;
  max_xp: number;
  gold: number;
  speed: number;
  mining_level: number;
  mining_xp: number;
  mining_max_xp: number;
  woodcutting_level: number;
  woodcutting_xp: number;
  woodcutting_max_xp: number;
  fishing_level: number;
  fishing_xp: number;
  fishing_max_xp: number;
  weaponcrafting_level: number;
  weaponcrafting_xp: number;
  weaponcrafting_max_xp: number;
  gearcrafting_level: number;
  gearcrafting_xp: number;
  gearcrafting_max_xp: number;
  jewelrycrafting_level: number;
  jewelrycrafting_xp: number;
  jewelrycrafting_max_xp: number;
  cooking_level: number;
  cooking_xp: number;
  cooking_max_xp: number;
  alchemy_level: number;
  alchemy_xp: number;
  alchemy_max_xp: number;
  hp: number;
  max_hp: number;
  haste: number;
  critical_strike: number;
  stamina: number;
  attack_fire: number;
  attack_earth: number;
  attack_water: number;
  attack_air: number;
  dmg_fire: number;
  dmg_earth: number;
  dmg_water: number;
  dmg_air: number;
  res_fire: number;
  res_earth: number;
  res_water: number;
  res_air: number;
  x: number;
  y: number;
  cooldown: number;
  cooldown_expiration: string;
  weapon_slot: string;
  shield_slot: string;
  helmet_slot: string;
  body_armor_slot: string;
  leg_armor_slot: string;
  boots_slot: string;
  ring1_slot: string;
  ring2_slot: string;
  amulet_slot: string;
  artifact1_slot: string;
  artifact2_slot: string;
  artifact3_slot: string;
  utility1_slot: string;
  utility1_slot_quantity: number;
  utility2_slot: string;
  utility2_slot_quantity: number;
  task: string;
  task_type: string;
  task_progress: number;
  task_total: number;
  inventory_max_items: number;
  inventory: IInventoryItem[];
}

export interface IData {
  character: ICharacter;
  cooldown: ICooldown;
  hp_restored?: number;
}

export interface IApiActionResponse {
  data: IData;
}

export interface IApiCharacterResponse {
  data: ICharacter;
}

export interface IErrorData {
  code: number;
  message: string;
}

export interface IErrorResponse {
  error: IErrorData;
}

export interface IItemEffect {
  name: string; // Effect name
  value: number; // Effect value
}

export interface ISimpleItem {
  code: string; // Item Code
  quantity: number; // Item quantity
}

export interface ICraft {
  skill: keyof typeof SKILL; // Skill required to craft the item
  level: number; // The skill level required to craft the item
  items: ISimpleItem[]; // List of items required to craft the item
  quantity: number; // Quantity of items crafted
}

export interface IItem {
  name: string; // Item name
  code: string; // Item code. This is the item's unique identifier (ID)
  level: number; // Item level
  type: string; // Item type
  subtype: string; // Item subtype
  description: string; // Item description
  effects: IItemEffect[]; // List of object effects. For equipment, it will include item stats
  craft: ICraft; // Craft information
  tradeable: boolean; // Item tradeable status. A non-tradeable item cannot be exchanged or sold
}

export interface IItemsAPIResponse {
  data: IItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

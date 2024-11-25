import { Character } from './character';
import { ItemSchema, MapSchema, MonsterSchema, ResourceSchema, SimpleItemSchema, CraftSchema, XY, BankSchema } from './client';
import { fetchBank, fetchBankItems, fetchGE, fetchItems, fetchMaps, fetchMonsters, fetchResources } from './network';
import { warn } from './util';

export class World {
  public static bankItems: Array<SimpleItemSchema>;
  public static allItems: Array<ItemSchema>;
  public static maps: Array<MapSchema>;
  public static monsters: Array<MonsterSchema>;
  public static resources: Array<ResourceSchema>;
  public static itemCodes: Array<string>;
  public static resourceCodes: Array<string>;
  public static skills: Array<string>;
  public static monsterCodes: Array<string>;
  public static equipSlots: Array<string>;
  public static characterName: string = process.env.CHARACTER;
  public static bank: BankSchema;

  public static async init() {
    World.bankItems = await fetchBankItems();
    World.allItems = await fetchItems();
    World.maps = await fetchMaps();
    World.monsters = await fetchMonsters();
    World.resources = await fetchResources();
    World.bank = await fetchBank();

    World.itemCodes = Array.from(new Set(World.allItems.map(item => item.code).filter(Boolean)));
    World.resourceCodes = Array.from(new Set(World.resources.map(item => item.code).filter(Boolean)));
    World.skills = Array.from(new Set(World.allItems.map(item => item.craft?.skill).filter(Boolean)));
    World.monsterCodes = Array.from(new Set(World.monsters.map(monster => monster.code).filter(Boolean)));
    World.monsterCodes = Array.from(new Set(World.monsters.map(monster => monster.code).filter(Boolean)));
  }

  public static async updateBank() {
    World.bank = await fetchBank();
    World.bankItems = await fetchBankItems();
  }

  public static getItemLevel(itemCode: string): number {
    return this.allItems.find(val => val.code === itemCode).level;
  }

  public static getCraftingRecipe(itemCode: string): CraftSchema {
    return this.allItems.find(val => val.code === itemCode)?.craft;
  }

  public static getItemResource(itemCode: string, character?: Character, limitByLevel = true): string {
    const matchingResources = this.resources.filter(item => item.drops.find(val => val.code === itemCode) && (!limitByLevel || character.skillLevel(item.skill) >= item.level));
    if (matchingResources.length === 0) {
      return;
    }
    return matchingResources[0].code;
  }

  public static getAllGatherableResources(character: Character): Array<ResourceSchema> {
    return this.resources.filter(resource => character.skillLevel(resource.skill) >= resource.level);
  }

  public static getCraftingSkill(itemCode: string): string {
    return this.allItems.find(val => val.code === itemCode).craft?.skill;
  }

  public static getNearestMap(resource: string, character: Character): MapSchema {
    const resourceMaps = this.maps.filter(map => map.content?.code === resource);
    if (resourceMaps.length === 0) {
      warn(`No maps found with resource ${resource}`);
      return;
    }
    const nearestMap = resourceMaps.reduce(
      (acc, val) => {
        const distance = Math.abs(character.location.x - val.x) + Math.abs(character.location.y - val.y);
        if (distance < acc.distance) {
          return { distance, map: val };
        }
        return acc;
      },
      { distance: Infinity, map: null },
    );
    return nearestMap.map;
  }

  public static getNearestMapLocation(resource: string, character: Character): XY {
    const nearestMap = this.getNearestMap(resource, character);
    if (!nearestMap) return;
    return { x: nearestMap.x, y: nearestMap.y };
  }

  public static async getPrice(itemCode: string): Promise<number> {
    const item = this.allItems.find(val => val.code === itemCode);
    if (!item) {
      warn(`Item ${itemCode} not found`);
      return;
    }
    const response = await fetchGE(itemCode);
    response.sort((a, b) => a.price - b.price);
    return response[0].price;
  }

  public static async getItemDescription(itemCode: string, characters: Array<Character>, includePrice = false): Promise<string> {
    let result = '';
    const item = this.allItems.find(val => val.code === itemCode);
    if (!item) {
      warn(`Item ${itemCode} not found`);
      return;
    }
    const canCraft = characters.every(character => character.canCraft(item.code));
    if (canCraft) {
      result += `🛠️ `;
    }
    const canEquip = characters.every(character => character.canEquip(item.code));
    const equipColor = canEquip ? '\x1b[32m' : '\x1b[31m'; // green or red
    result += `${item.name} (${equipColor}lvl ${item.level}\x1b[0m)`;
    if (item.craft) {
      const hasSkillLevel = characters.every(character => character.skillLevel(item.craft.skill) >= item.craft.level);
      const levelColor = hasSkillLevel ? '\x1b[32m' : '\x1b[31m'; // green or red
      result += ` - ${levelColor}${item.craft.skill} ${item.craft.level}\x1b[0m`;
    }
    if (item.effects?.length > 0) {
      result += ' -';
      result += item.effects.map(effect => ` ${effect.name}: ${effect.value}`).join(',');
    }
    if (includePrice) {
      result += ` - ${await this.getPrice(itemCode)}g`;
    }
    return result;
  }
}

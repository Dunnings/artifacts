import { Character } from './character';
import { ItemSchema, MapSchema, MonsterSchema, ResourceSchema, SimpleItemSchema, CraftSchema, XY, BankSchema } from './client';
import { fetchBank, fetchBankItems, fetchItems, fetchMaps, fetchMonsters, fetchResources } from './network';
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
  }

  public static getCraftingRecipe(itemCode: string): CraftSchema {
    return this.allItems.find(item => item.code === itemCode)?.craft;
  }

  public static getItemResource(itemCode: string, character?: Character, limitByLevel = true): string {
    const matchingResources = this.resources.filter(item => item.drops.find(drop => drop.code === itemCode) && (!limitByLevel || character.skillLevel(item.skill) >= item.level));
    if (matchingResources.length === 0) {
      return;
    }
    return matchingResources[0].code;
  }

  public static getAllGatherableResources(character: Character): Array<ResourceSchema> {
    return this.resources.filter(resource => character.skillLevel(resource.skill) >= resource.level);
  }

  public static getCraftingSkill(itemCode: string): string {
    return this.allItems.find(item => item.code === itemCode).craft?.skill;
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
}

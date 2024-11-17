import { ItemCode, MonsterCode, ResourceCode, SkillCode } from './enums';
import { IBankItem, ICraft, IInventoryItem, IItem, ILocation, IMap, IMonster, IResource } from './interfaces';
import { Model } from './model';
import { info, warn } from './util';

export function getCraftingRecipe(itemCode: ItemCode): ICraft {
  return Model.items.find(item => item.code === itemCode).craft;
}

export function getResource(itemCode: ItemCode, limitByLevel = true): ResourceCode {
  const matchingResources = Model.resources.filter(item => item.drops.find(drop => drop.code === itemCode) && (!limitByLevel || Model.character[`${item.skill}_level`] >= item.level));
  if (matchingResources.length === 0) {
    warn(`No resources found for ${itemCode}`);
    return;
  }
  return matchingResources[0].code;
}

export function getGatherableResources(): Array<IResource> {
  return Model.resources.filter(resource => Model.character[`${resource.skill}_level`] >= resource.level);
}

export function characterHasEnoughOfItemForRecipe(itemToCraft: ItemCode, itemToGather: ItemCode, quantityToCraft = 1, includeBankInventory = false): boolean {
  const craftingSpec = getCraftingRecipe(itemToCraft);
  return craftingSpec.items.find(item => item.code === itemToGather).quantity * quantityToCraft <= getItemCount(itemToGather, includeBankInventory);
}

export function characterHasCraftingIngredients(itemCode: ItemCode, quantity = 1, includeBankInventory = false): boolean {
  const craftingSpec = getCraftingRecipe(itemCode);
  return craftingSpec.items.every(item => characterHasItem(item.code, item.quantity * quantity, includeBankInventory));
}

export function characterHasCraftingLevel(itemCode: ItemCode, iterative = false): boolean {
  const craftingSpec = getCraftingRecipe(itemCode);

  if (!craftingSpec) {
    return;
  }

  if (iterative && craftingSpec?.items) {
    return craftingSpec.items.every(item => characterHasCraftingLevel(item.code, true) !== false);
  }

  return Model.character[`${craftingSpec.skill}_level`] >= craftingSpec.level;
}

export function canCraft(itemCode: ItemCode, includeBankInventory = false): boolean {
  return characterHasCraftingLevel(itemCode) && characterHasCraftingIngredients(itemCode, 1, includeBankInventory);
}

export function getCraftingStation(itemCode: ItemCode): SkillCode {
  return Model.items.find(item => item.code === itemCode).craft?.skill;
}

export function characterAtLocation(location: { x: number; y: number }): boolean {
  return Model.character.x === location.x && Model.character.y === location.y;
}

export function characterHasItem(itemCode: ItemCode, minQuantity = 0, includeBankInventory = false): boolean {
  if (!Model.inventory) return false;
  const inventory: Array<IBankItem | IInventoryItem> = [...Model.inventory];
  if (includeBankInventory && Model.bankItems) inventory.push(...Model.bankItems);
  const success = inventory?.find(val => val.code === itemCode && val.quantity >= minQuantity);
  if (success) return true;
  return false;
}

export function bankHasItem(itemCode: ItemCode, minQuantity = 0): boolean {
  if (!Model.bankItems) return false;
  const success = Model.bankItems?.find(val => val.code === itemCode && val.quantity >= minQuantity);
  if (success) return true;
  return false;
}

export function characterInventorySpaceRemaining(): number {
  if (!Model.inventory) return 0;
  return Model.character.inventory_max_items - Model.inventory.reduce((acc, val) => acc + val.quantity, 0);
}

export function findCraftableItems(includeBankInventory = false): Array<IItem> {
  const craftableItems = Model.items.filter(
    item =>
      item?.craft?.items &&
      item.craft.items.every(craftingItem => characterHasItem(craftingItem.code, craftingItem.quantity, includeBankInventory)) &&
      (Model.character[`${item.craft.skill}_level`] ?? 0) >= item.craft.level,
  );
  if (craftableItems.length === 0) {
    info('No craftable items found');
    return;
  }
  info(`Found ${craftableItems.length} craftable items: ${craftableItems.map(item => item.code).join(', ')}`);
  return craftableItems;
}

export function getNearestMapLocation(resource: ResourceCode | SkillCode | MonsterCode): ILocation {
  const nearestMap = getNearestMap(resource);
  if (!nearestMap) return;
  return { x: nearestMap.x, y: nearestMap.y };
}

export function getNearestMap(resource: ResourceCode | SkillCode | MonsterCode): IMap {
  const resourceMaps = Model.maps.filter(map => map.content?.code === resource);
  if (resourceMaps.length === 0) {
    warn(`No maps found with resource ${resource}`);
    return;
  }
  const nearestMap = resourceMaps.reduce(
    (acc, val) => {
      const distance = Math.abs(Model.character.x - val.x) + Math.abs(Model.character.y - val.y);
      if (distance < acc.distance) {
        return { distance, map: val };
      }
      return acc;
    },
    { distance: Infinity, map: null },
  );
  return nearestMap.map;
}

export function getItemCount(itemCode: ItemCode, includeBankInventory = false): number {
  const inventory: Array<IBankItem | IInventoryItem> = [...Model.inventory];
  if (includeBankInventory && Model.bankItems) {
    inventory.push(...Model.bankItems);
  }
  return inventory.reduce((acc, val) => (val.code === itemCode ? val.quantity + acc : acc), 0);
}

export function getCraftableQuantity(itemCode: ItemCode, includeBankInventory = false): number {
  const craftingSpec = getCraftingRecipe(itemCode);
  if (!craftingSpec) {
    warn(`Item ${itemCode} is not craftable`);
    return 0;
  }
  if (!characterHasCraftingLevel(itemCode)) {
    warn(`Skill level too low to craft ${itemCode}. Required: ${craftingSpec.level}. Current: ${Model.character[`${craftingSpec.skill}_level`]}`);
    return 0;
  }
  const maxCraftable = craftingSpec.items.reduce((acc, craftingIngredient) => {
    const quantity = Math.floor(getItemCount(craftingIngredient.code, includeBankInventory) / craftingIngredient.quantity);
    return quantity < acc ? quantity : acc;
  }, Infinity);
  return maxCraftable;
}

export function logQuantityDifferenceInItems(before: (IInventoryItem | IBankItem)[], after: (IInventoryItem | IBankItem)[]): void {
  info('Results:');
  Model.items.forEach(item => {
    const beforeQuantity = before.reduce((acc, val) => (val.code === item.code ? acc + val.quantity : acc), 0);
    const afterQuantity = after.reduce((acc, val) => (val.code === item.code ? acc + val.quantity : acc), 0);
    if (beforeQuantity !== afterQuantity) {
      const absDiff = Math.abs(beforeQuantity - afterQuantity);
      const changeSymbol = afterQuantity > beforeQuantity ? '+' : '-';
      if (changeSymbol === '+') {
        console.log(`\x1b[32m${changeSymbol}${absDiff} ${item.code}\x1b[0m`);
      } else {
        console.log(`\x1b[31m${changeSymbol}${absDiff} ${item.code}\x1b[0m`);
      }
    }
  });
}

export function createShoppingList(itemCode: ItemCode, quantity: number = 1, shoppingList?: Record<ItemCode, number>): Record<ItemCode, number> {
  const isTopLevel = shoppingList === undefined;
  if (isTopLevel) shoppingList = {} as Record<ItemCode, number>;

  const craftingSpec = getCraftingRecipe(itemCode);
  if (!craftingSpec || (!isTopLevel && characterHasItem(itemCode, quantity, true))) {
    if (!shoppingList[itemCode]) shoppingList[itemCode] = 0;
    shoppingList[itemCode] = shoppingList[itemCode] + quantity;
    return shoppingList;
  }

  for (const craftingItem of craftingSpec.items) {
    shoppingList = createShoppingList(craftingItem.code, craftingItem.quantity * quantity, shoppingList);
  }

  return shoppingList;
}

export function canKill(monster: IMonster): boolean {
  const player_health = Model.character.max_hp;
  const player_attack_fire = Model.character.attack_fire;
  const player_attack_earth = Model.character.attack_earth;
  const player_attack_water = Model.character.attack_water;
  const player_attack_air = Model.character.attack_air;
  const player_res_fire = Model.character.res_fire;
  const player_res_earth = Model.character.res_earth;
  const player_res_water = Model.character.res_water;
  const player_res_air = Model.character.res_air;
  const monster_health = monster.hp;
  const monster_attack_fire = monster.attack_fire;
  const monster_attack_earth = monster.attack_earth;
  const monster_attack_water = monster.attack_water;
  const monster_attack_air = monster.attack_air;
  const monster_res_fire = monster.res_fire;
  const monster_res_earth = monster.res_earth;
  const monster_res_water = monster.res_water;
  const monster_res_air = monster.res_air;

  let temp_player_health = player_health;
  let temp_monster_health = monster_health;

  while (temp_player_health > 0 && temp_monster_health > 0) {
    temp_monster_health -= Math.max(0, player_attack_fire * (1 - monster_res_fire * 0.01));
    temp_monster_health -= Math.max(0, player_attack_earth * (1 - monster_res_earth * 0.01));
    temp_monster_health -= Math.max(0, player_attack_water * (1 - monster_res_water * 0.01));
    temp_monster_health -= Math.max(0, player_attack_air * (1 - monster_res_air * 0.01));

    temp_player_health -= Math.max(0, monster_attack_fire * (1 - player_res_fire * 0.01));
    temp_player_health -= Math.max(0, monster_attack_earth * (1 - player_res_earth * 0.01));
    temp_player_health -= Math.max(0, monster_attack_water * (1 - player_res_water * 0.01));
    temp_player_health -= Math.max(0, monster_attack_air * (1 - player_res_air * 0.01));
  }

  return temp_player_health > 0;
}

export function findKillableMonsters(): Array<IMonster> {
  const killableMonsters = Model.monsters.filter(monster => canKill(monster));
  if (killableMonsters.length === 0) {
    info('No killable monsters found');
    return;
  }
  info(`Found ${killableMonsters.length} killable monsters: ${killableMonsters.map(item => item.code).join(', ')}`);
  return killableMonsters;
}

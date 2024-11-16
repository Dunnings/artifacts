import { ItemCode, Resource } from './enums';
import { IBankItem, IInventoryItem, IItem, ILocation, IMap } from './interfaces';
import { Model } from './model';
import { log, warn } from './util';

export function characterHasCraftingIngredients(itemCode: ItemCode, quantity = 1, includeBankInventory = false): boolean {
  const craftingSpec = Model.items.find(item => item.code === itemCode)?.craft;
  return craftingSpec.items.every(item => characterHasItem(item.code, item.quantity * quantity, includeBankInventory));
}

export function characterHasCraftingLevel(itemCode: ItemCode): boolean {
  const craftingSpec = Model.items.find(item => item.code === itemCode)?.craft;
  return Model.character[`${craftingSpec.skill}_level`] >= craftingSpec.level;
}

export function canCraft(itemCode: ItemCode, includeBankInventory = false): boolean {
  return characterHasCraftingLevel(itemCode) && characterHasCraftingIngredients(itemCode, 1, includeBankInventory);
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
    log('No craftable items found');
    return;
  }
  log(`Found ${craftableItems.length} craftable items: ${craftableItems.map(item => item.code).join(', ')}`);
  return craftableItems;
}

export function getNearestMapLocation(resource: Resource): ILocation {
  const nearestMap = getNearestMap(resource);
  if (!nearestMap) return;
  return { x: nearestMap.x, y: nearestMap.y };
}

export function getNearestMap(resource: Resource): IMap {
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

export function getCraftableQuantity(itemCode: ItemCode): number {
  const craftingSpec = Model.items.find(item => item.code === itemCode)?.craft;
  if (!craftingSpec) {
    warn(`Item ${itemCode} is not craftable`);
    return 0;
  }
  if (!characterHasCraftingLevel(itemCode)) {
    warn(`Skill level too low to craft ${itemCode}. Required: ${craftingSpec.level}. Current: ${Model.character[`${craftingSpec.skill}_level`]}`);
    return 0;
  }
  const maxCraftable = craftingSpec.items.reduce((acc, craftingIngredient) => {
    const quantity = Math.floor(Model.inventory.find(invItem => invItem.code === craftingIngredient.code).quantity / craftingIngredient.quantity);
    return quantity < acc ? quantity : acc;
  }, Infinity);
  return maxCraftable;
}

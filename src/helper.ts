import { ItemCode, Resource } from './enums';
import { IBankItem, ICraft, IInventoryItem, IItem, ILocation, IMap } from './interfaces';
import { Model } from './model';
import { info, log, warn } from './util';

export function getCraftingRecipe(itemCode: ItemCode): ICraft {
  return Model.items.find(item => item.code === itemCode).craft;
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

import { Action, EquipSlot, ItemCode, Resource } from './enums';
import { IApiActionResponse, IApiCharacterResponse, ICharacterData, IErrorResponse, IItem, IItemsAPIResponse, ILocation, IMap, IMapAPIResponse } from './interfaces';
import { catchPromise, log, time, warn } from './util';
import { actionCall, bankItemsCall, characterCall, itemCall, mapCall } from './network';

async function waitForCooldown(cooldownExpiration: string) {
  if (!cooldownExpiration) return;
  const cooldown = new Date(cooldownExpiration).getTime() - Date.now() + 200;
  if (cooldown <= 0) return;
  const seconds = Math.floor((cooldown / 1000) % 60);
  const minutes = Math.floor((cooldown / (1000 * 60)) % 60);
  time(`${minutes}m ${seconds}s`);
  return new Promise(resolve => setTimeout(resolve, cooldown));
}

async function getCharacter(): Promise<ICharacterData> {
  const [response, error] = await catchPromise<IApiCharacterResponse>(characterCall());
  if (error) return;
  return response.data;
}

async function getItems(): Promise<IItem[]> {
  const items: IItem[] = [];
  let page = 1;
  let pages: number;
  do {
    const [response, error] = await catchPromise<IItemsAPIResponse>(itemCall(page));
    if (error) return;
    response.data.forEach(element => {
      items.push(element);
    });
    pages = response.pages;
    page = response.page + 1;
  } while (page < pages);
  return items;
}

async function getBankItems(): Promise<IItem[]> {
  const items: IItem[] = [];
  let page = 1;
  let pages: number;
  do {
    const [response, error] = await catchPromise<IItemsAPIResponse>(bankItemsCall(page));
    if (error) return;
    response.data.forEach(element => {
      items.push(element);
    });
    pages = response.pages;
    page = response.page + 1;
  } while (page < pages);
  return items;
}

async function getMaps(): Promise<Array<IMap>> {
  const maps: IMap[] = [];
  let page = 1;
  let pages: number;
  do {
    const [response, error] = await catchPromise<IMapAPIResponse>(mapCall(page));
    if (error) return;
    response.data.forEach(element => {
      maps.push(element);
    });
    pages = response.pages;
    page = response.page + 1;
  } while (page < pages);
  return maps;
}

async function doAction(character: ICharacterData, action: Action, args?: any): Promise<void> {
  const [response, error] = await catchPromise<IApiActionResponse>(actionCall(action, args));
  if (error) {
    warn(`Error: ${JSON.stringify(error)}`);
    return;
  }
  if (response.data === undefined) {
    warn(`Error: ${JSON.stringify(response)}`);
    return;
  }
  Object.assign(character, response.data.character);
  log(`${action}`);
}

async function doActionAndWait(character: ICharacterData, action: Action, data?: unknown): Promise<void> {
  await doAction(character, action, data);
  await waitForCooldown(character.cooldown_expiration);
}

function characterIsAtLocation(character: ICharacterData, location: { x: number; y: number }): boolean {
  return character.x === location.x && character.y === location.y;
}

function characterHasItem(character: ICharacterData, itemCode: ItemCode, minQuantity = 0): boolean {
  if (!character?.inventory) return false;
  const success = character?.inventory?.find(val => val.code === itemCode && val.quantity >= minQuantity);
  if (success) return true;
  return false;
}

function inventorySpaceRemaining(character: ICharacterData): number {
  if (!character?.inventory) return 0;
  return character.inventory_max_items - character.inventory.reduce((acc, val) => acc + val.quantity, 0);
}

function getNearestMap(character: ICharacterData, maps: IMap[], resource: Resource): IMap {
  const resourceMaps = maps.filter(map => map.content?.code === resource);
  if (resourceMaps.length === 0) {
    warn(`No maps found with resource ${resource}`);
    return;
  }
  const nearestMap = resourceMaps.reduce(
    (acc, val) => {
      const distance = Math.abs(character.x - val.x) + Math.abs(character.y - val.y);
      if (distance < acc.distance) {
        return { distance, map: val };
      }
      return acc;
    },
    { distance: Infinity, map: null },
  );
  return nearestMap.map;
}

function getNearestMapLocation(character: ICharacterData, maps: IMap[], resource: Resource): ILocation {
  const nearestMap = getNearestMap(character, maps, resource);
  if (!nearestMap) return;
  return { x: nearestMap.x, y: nearestMap.y };
}

function checkCraftableItems(character: ICharacterData, allItems: IItem[]): void {
  const craftableItems = allItems.filter(
    item =>
      item?.craft?.items &&
      item.craft.items.every(craftingItem => characterHasItem(character, craftingItem.code, craftingItem.quantity)) &&
      (character[`${item.craft.skill}_level`] ?? 0) >= item.craft.level,
  );
  if (craftableItems.length === 0) {
    log('No craftable items found');
    return;
  }
  log(`Found ${craftableItems.length} craftable items: ${craftableItems.map(item => item.code).join(', ')}`);
}

// Common action macros

async function depositAllItems(character: ICharacterData): Promise<void> {
  for (const item of character.inventory) {
    if (item.quantity === 0) continue;
    await doActionAndWait(character, Action.deposit, { code: item.code, quantity: item.quantity });
  }
}

async function craft(character: ICharacterData, allItems: IItem[], itemCode: ItemCode): Promise<void> {
  const craftingSpec = allItems.find(item => item.code === itemCode)?.craft;
  if (character[`${craftingSpec.skill}_level`] < craftingSpec.level) {
    warn(`Skill level too low to craft ${itemCode}. Required: ${craftingSpec.level}. Current: ${character[`${craftingSpec.skill}_level`]}`);
    return;
  }
  if (!craftingSpec.items.every(item => characterHasItem(character, item.code, item.quantity))) {
    warn(`Not enough materials to craft ${itemCode}. Missing: ${craftingSpec.items.map(item => `${item.quantity} ${item.code}`).join(', ')}`);
  }
  await doActionAndWait(character, Action.crafting, { code: itemCode });
}

async function unequip(character: ICharacterData, slot: EquipSlot) {
  await doActionAndWait(character, Action.unequip, { slot });
}

async function equip(character: ICharacterData, code: ItemCode, slot: EquipSlot) {
  await doActionAndWait(character, Action.equip, { slot, code });
}

async function rest(character: ICharacterData) {
  await doActionAndWait(character, Action.rest);
}

async function move(character: ICharacterData, location: ILocation) {
  if (characterIsAtLocation(character, location)) {
    return;
  }
  await doActionAndWait(character, Action.move, location);
}

async function gather(character: ICharacterData) {
  await doActionAndWait(character, Action.gathering);
}

(async () => {
  // Standard actions
  const allItems = await getItems();
  const maps = await getMaps();
  let bankItems = await getBankItems();
  let character = await getCharacter();

  // Wait for any outstanding cooldowns
  await waitForCooldown(character.cooldown_expiration);

  // Custom actions
  while (true) {
    if (inventorySpaceRemaining(character) < 5) {
      await move(character, getNearestMapLocation(character, maps, Resource.bank));
      await depositAllItems(character);
    }
    await move(character, getNearestMapLocation(character, maps, Resource.iron_rocks));
    await gather(character);
  }
})();

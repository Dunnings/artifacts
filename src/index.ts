import { Action, EquipSlot, ItemCode, Location } from './enums';
import { IApiActionResponse, IApiCharacterResponse, ICharacter, IErrorResponse, IItem, IItemsAPIResponse } from './interfaces';
import { catchPromise, log, time, warn } from './util';
import { actionCall, bankItemsCall, characterCall, itemCall } from './network';

let characterData: ICharacter;
let cooldownExpiration: string;
let allItems: IItem[];
let bankItems: IItem[];

async function waitForCooldown() {
  if (!cooldownExpiration) return;
  const cooldown = new Date(cooldownExpiration).getTime() - Date.now() + 200;
  if (cooldown <= 0) return;
  const seconds = Math.floor((cooldown / 1000) % 60);
  const minutes = Math.floor((cooldown / (1000 * 60)) % 60);
  time(`${minutes}m ${seconds}s`);
  return new Promise(resolve => setTimeout(resolve, cooldown));
}

async function getCharacter() {
  const [response, error] = await catchPromise<IApiCharacterResponse>(characterCall());
  if (error) return;
  characterData = response.data;
  cooldownExpiration = characterData.cooldown_expiration;
}

async function getItems() {
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
  allItems = items;
  log(`Retreived all ${allItems.length} items`);
  const invalidItems = allItems.filter(item => !Object.values(ItemCode).includes(item.code as ItemCode));
  if (invalidItems.length > 0) {
    warn(`Found items with invalid codes: ${invalidItems.map(item => item.code).join(', ')}`);
  }
  const missingItems = Object.values(ItemCode).filter(code => !allItems.some(item => item.code === code));
  if (missingItems.length > 0) {
    warn(`Missing items: ${missingItems.join(', ')}`);
  }
}

async function getBankItems() {
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
  bankItems = items;
  log(`Retrieved bank items`);
}

async function doAction(action: Action, args?: any) {
  const [response, error] = await catchPromise<IApiActionResponse>(actionCall(action, args));
  if (error) return;
  if (response.data === undefined) {
    warn(`Error: ${JSON.stringify(response)}`);
    return;
  }
  characterData = response.data.character;
  cooldownExpiration = characterData.cooldown_expiration;
  log(`${action}`);
}

async function doActionAndWait(action: Action, data?: any) {
  if (action === Action.move && characterIsAtLocation(data)) {
    return;
  }
  await doAction(action, data);
  await waitForCooldown();
}

function characterIsAtLocation(location: { x: number; y: number }): boolean {
  return characterData.x === location.x && characterData.y === location.y;
}

function hasItem(itemCode: ItemCode, minQuantity = 0): boolean {
  if (!characterData?.inventory) return false;
  const success = characterData?.inventory?.find(val => val.code === itemCode && val.quantity >= minQuantity);
  if (success) return true;
  return false;
}

function inventorySpaceRemaining(): number {
  if (!characterData?.inventory) return 0;
  return characterData.inventory_max_items - characterData.inventory.reduce((acc, val) => acc + val.quantity, 0);
}

function checkCraftableItems() {
  const craftableItems = allItems.filter(
    item => item?.craft?.items && item.craft.items.every(craftingItem => hasItem(craftingItem.code, craftingItem.quantity)) && (characterData[`${item.craft.skill}_level`] ?? 0) >= item.craft.level,
  );
  if (craftableItems.length === 0) {
    log('No craftable items found');
    return;
  }
  log(`Found ${craftableItems.length} craftable items: ${craftableItems.map(item => item.code).join(', ')}`);
}

// Common action macros

async function depositAllItems() {
  await doActionAndWait(Action.move, Location.Bank);
  for (const item of characterData.inventory) {
    if (item.quantity === 0) continue;
    await doActionAndWait(Action.deposit, { code: item.code, quantity: item.quantity });
  }
  await getBankItems();
}

async function gatherAshWood() {
  await doActionAndWait(Action.move, Location.AshTree);
  await doActionAndWait(Action.gathering);
}

async function gatherCopper() {
  await doActionAndWait(Action.move, Location.Copper);
  await doActionAndWait(Action.gathering);
}

async function craftWoodStaff() {
  await doActionAndWait(Action.move, Location.WeaponCraftingStation);
  await doActionAndWait(Action.crafting, { code: 'wooden_staff' });
}

async function craftAshPlank() {
  if (!hasItem(ItemCode.ash_wood, 8)) return;
  await doActionAndWait(Action.move, Location.WoodCuttingStation);
  await doActionAndWait(Action.crafting, { code: 'ash_plank' });
}

async function craftWoodShield() {
  if (!hasItem(ItemCode.ash_plank, 6)) return;
  await doActionAndWait(Action.move, Location.GearCraftingStation);
  await doActionAndWait(Action.crafting, { code: ItemCode.wooden_shield });
}

async function craft(itemCode: ItemCode) {
  const craftingSpec = allItems.find(item => item.code === itemCode)?.craft;
  if (characterData[`${craftingSpec.skill}_level`] < craftingSpec.level) {
    warn(`Skill level too low to craft ${itemCode}. Required: ${craftingSpec.level}. Current: ${characterData[`${craftingSpec.skill}_level`]}`);
    return;
  }
  if (!craftingSpec.items.every(item => hasItem(item.code, item.quantity))) {
    warn(`Not enough materials to craft ${itemCode}. Missing: ${craftingSpec.items.map(item => `${item.quantity} ${item.code}`).join(', ')}`);
  }
  await doActionAndWait(Action.crafting, { code: itemCode });
}

async function killChickens() {
  await doActionAndWait(Action.move, Location.Chickens);
  await doActionAndWait(Action.fight);
  await doActionAndWait(Action.rest);
}

async function killCows() {
  await doActionAndWait(Action.move, Location.Cows);
  await doActionAndWait(Action.fight);
  await doActionAndWait(Action.rest);
}

async function unequip(slot: EquipSlot) {
  await doActionAndWait(Action.unequip, { slot });
}

async function equip(code: ItemCode, slot: EquipSlot) {
  await doActionAndWait(Action.equip, { slot, code });
}

async function rest() {
  await doActionAndWait(Action.rest);
}

// Standard actions
await getCharacter();
await getItems();
await getBankItems();
checkCraftableItems();
await waitForCooldown();
// Custom actions
while (true) {
  await doActionAndWait(Action.move, Location.Iron);
  await doActionAndWait(Action.gathering);

  if (inventorySpaceRemaining() < 5) {
    await depositAllItems();
  }
}

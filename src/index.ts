import { ACTION, ITEMCODE, LOCATION } from './enums';
import { IApiActionResponse, IApiCharacterResponse, ICharacter, IErrorResponse, IItem, IItemsAPIResponse } from './interfaces';
import { catchPromise, log, time, warn } from './util';
import { actionCall, characterCall, itemCall } from './network';

let characterData: ICharacter;
let cooldownExpiration: string;
let itemData: IItem[];

async function waitForCooldown() {
  if (!cooldownExpiration) return;
  const cooldown = new Date(cooldownExpiration).getTime() - Date.now();
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
  } while (page !== pages);
  itemData = items;
  log(`Got ${itemData.length} items`);
}

async function doAction(action: string, args?: any) {
  const [response, error] = await catchPromise<IApiActionResponse>(actionCall(action, args));
  if (error) return;
  characterData = response.data.character;
  cooldownExpiration = characterData.cooldown_expiration;
  log(`${action}`);
}

async function doActionAndWait(action: string, data?: any) {
  if (action === ACTION.Move && characterIsAtLocation(data)) {
    return;
  }
  await doAction(action, data);
  await waitForCooldown();
}

function characterIsAtLocation(location: { x: number; y: number }): boolean {
  return characterData.x === location.x && characterData.y === location.y;
}

function hasItem(itemCode: string, minQuantity = 0): boolean {
  if (!characterData?.inventory) return false;
  const success = characterData?.inventory?.find(val => val.code === itemCode && val.quantity >= minQuantity);
  if (success) return true;
  warn(`Not enough ${itemCode}`);
  return false;
}

function inventorySpaceRemaining(): number {
  if (!characterData?.inventory) return 0;
  return characterData.inventory_max_items - characterData.inventory.reduce((acc, val) => acc + val.quantity, 0);
}

// Common action macros

async function depositAllItems() {
  await doActionAndWait(ACTION.Move, LOCATION.Bank);
  for (const item of characterData.inventory) {
    if (item.quantity === 0) continue;
    await doActionAndWait(ACTION.Deposit, { code: item.code, quantity: item.quantity });
  }
}

async function gatherAshWood() {
  await doActionAndWait(ACTION.Move, LOCATION.AshTree);
  await doActionAndWait(ACTION.Gather);
}

async function gatherCopper() {
  await doActionAndWait(ACTION.Move, LOCATION.Copper);
  await doActionAndWait(ACTION.Gather);
}

async function craftWoodStaff() {
  await doActionAndWait(ACTION.Move, LOCATION.WeaponCraftingStation);
  await doActionAndWait(ACTION.Craft, { code: 'wooden_staff' });
}

async function craftAshPlank() {
  if (!hasItem('ash_wood', 8)) return;
  await doActionAndWait(ACTION.Move, LOCATION.WoodCuttingStation);
  await doActionAndWait(ACTION.Craft, { code: 'ash_plank' });
}

async function craftWoodShield() {
  if (!hasItem('ash_plank', 6)) return;
  await doActionAndWait(ACTION.Move, LOCATION.GearCraftingStation);
  await doActionAndWait(ACTION.Craft, { code: ITEMCODE.WoodenShield });
}

async function killChickens() {
  await doActionAndWait(ACTION.Move, LOCATION.Chickens);
  await doActionAndWait(ACTION.Fight);
  await doActionAndWait(ACTION.Rest);
}

async function killCows() {
  await doActionAndWait(ACTION.Move, LOCATION.Cows);
  await doActionAndWait(ACTION.Fight);
  await doActionAndWait(ACTION.Rest);
}

async function unequip(slot: string) {
  await doActionAndWait(ACTION.Unequip, { slot });
}

async function equip(slot: string, code: string) {
  await doActionAndWait(ACTION.Equip, { slot, code });
}

async function rest() {
  await doActionAndWait(ACTION.Rest);
}

await getCharacter();
await getItems();
await rest();
await waitForCooldown();
while (true) {
  await gatherCopper();
  if (inventorySpaceRemaining() < 5) {
    await depositAllItems();
  }
}

import { ACTION, EQUIPSLOT, ITEMCODE, LOCATION } from './enums';
import { IApiActionResponse, IApiCharacterResponse, ICharacter, IErrorResponse } from './interfaces';
import { catchPromise, log, warn } from './util';
import { actionCall, characterCall } from './network';

let characterData: ICharacter;
let cooldownExpiration: string;

function parseAPIResponse(response: IApiActionResponse | IApiCharacterResponse | IErrorResponse) {
  if (!response) return;
  if ((response as IErrorResponse).error) {
    log('Error response from API:');
    console.error((response as IErrorResponse).error.message);
    return;
  } else if ((response as IApiActionResponse).data.character) {
    characterData = (response as IApiActionResponse).data.character;
    cooldownExpiration = characterData.cooldown_expiration;
  } else if ((response as IApiCharacterResponse).data) {
    characterData = (response as IApiCharacterResponse).data;
    cooldownExpiration = characterData.cooldown_expiration;
  }
}

async function waitForCooldown() {
  if (!cooldownExpiration) return;
  const cooldown = new Date(cooldownExpiration).getTime() - Date.now();
  if (cooldown <= 0) return;
  const seconds = Math.floor((cooldown / 1000) % 60);
  const minutes = Math.floor((cooldown / (1000 * 60)) % 60);
  console.log(`\x1b[35m⏱️  ${minutes}m ${seconds}s\x1b[0m`);
  return new Promise(resolve => setTimeout(resolve, cooldown));
}

async function getCharacter() {
  const [response, error] = await catchPromise(characterCall());
  if (error) return;
  parseAPIResponse(response);
}

async function doAction(action: string, args?: any) {
  const [response, error] = await catchPromise(actionCall(action, args));
  if (error) return;
  log(`${action}`);
  parseAPIResponse(response);
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

async function unequipWeapon() {
  await doActionAndWait(ACTION.Unequip, { slot: 'weapon' });
}

async function equip(slot: string, itemCode: string) {
  await doActionAndWait(ACTION.Equip, { slot: slot, code: itemCode });
}

async function rest() {
  await doActionAndWait(ACTION.Rest);
}

await getCharacter();
await waitForCooldown();
while (true) {
  await killChickens();
  if (inventorySpaceRemaining() < 5) {
    await depositAllItems();
  }
}

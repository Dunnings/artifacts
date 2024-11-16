import { Action, EquipSlot, ItemCode, Resource } from './enums';
import { characterAtLocation, characterHasCraftingIngredients, characterHasCraftingLevel, characterInventorySpaceRemaining, getNearestMapLocation, getCraftableQuantity } from './helper';
import { IApiActionResponse, ILocation } from './interfaces';
import { Model } from './model';
import { actionCall } from './network';
import { catchPromise, log, time, warn } from './util';

export async function waitForCooldown() {
  if (!Model.cooldownExpiration) return;
  const cooldown = new Date(Model.cooldownExpiration).getTime() - Date.now() + 200;
  if (cooldown <= 0) return;
  const seconds = Math.floor((cooldown / 1000) % 60);
  const minutes = Math.floor((cooldown / (1000 * 60)) % 60);
  time(`${minutes}m ${seconds}s`);
  return new Promise(resolve => setTimeout(resolve, cooldown));
}

export async function doAction(action: Action, args?: any): Promise<void> {
  const [response, error] = await catchPromise<IApiActionResponse>(actionCall(action, args));
  if (error) {
    warn(`Error: ${JSON.stringify(error)}`);
    return;
  }
  if (response.data === undefined) {
    warn(`Error: ${JSON.stringify(response)}`);
    return;
  }
  Model.character = response.data.character;
  log(`${action}`);
}

export async function doActionAndWait(action: Action, data?: unknown): Promise<void> {
  await doAction(action, data);
  await waitForCooldown();
}

export async function depositAllItems(): Promise<void> {
  for (const item of Model.inventory) {
    if (item.quantity === 0) continue;
    await doActionAndWait(Action.deposit, { code: item.code, quantity: item.quantity });
  }
}

export async function craft(itemCode: ItemCode, quantity = 1): Promise<void> {
  const craftingSpec = Model.items.find(item => item.code === itemCode)?.craft;
  if (!craftingSpec) {
    warn(`Item ${itemCode} is not craftable`);
    return;
  }
  if (!characterHasCraftingLevel(itemCode)) {
    warn(`Skill level too low to craft ${itemCode}. Required: ${craftingSpec.level}. Current: ${Model.character[`${craftingSpec.skill}_level`]}`);
    return;
  }
  if (!characterHasCraftingIngredients(itemCode, quantity)) {
    warn(`Not enough materials to craft ${itemCode}. Missing: ${craftingSpec.items.map(item => `${item.quantity} ${item.code}`).join(', ')}`);
    return;
  }
  await doActionAndWait(Action.crafting, { code: itemCode, quantity });
}

export async function equip(code: ItemCode, slot: EquipSlot) {
  await doActionAndWait(Action.equip, { slot, code });
}

export async function unequip(slot: EquipSlot) {
  await doActionAndWait(Action.unequip, { slot });
}

export async function rest() {
  await doActionAndWait(Action.rest);
}

export async function move(location: ILocation) {
  if (characterAtLocation(location)) return;
  await doActionAndWait(Action.move, location);
}

export async function gather() {
  await doActionAndWait(Action.gathering);
}

export async function withdraw(code: ItemCode, quantity: number) {
  await move(getNearestMapLocation(Resource.bank));
  await doActionAndWait(Action.withdraw, { code, quantity });
}

/**
 * Call this anytime you are going to add something to the inventory to prevent full errors
 */
export async function emptyInventoryIfFull() {
  if (characterInventorySpaceRemaining() >= 3) return;
  await move(getNearestMapLocation(Resource.bank));
  await depositAllItems();
}

/**
 * Go to the nearest bank, deposit all items, withdraw as much iron ore as possible, then craft iron bars
 */
export async function forgeIron(): Promise<void> {
  await emptyInventoryIfFull();

  // If we don't have enough to make one iron bar, withdraw as much of the ingredients as we can
  if (!characterHasCraftingIngredients(ItemCode.iron, 1)) {
    await move(getNearestMapLocation(Resource.bank));
    await depositAllItems();
    await withdraw(ItemCode.iron_ore, characterInventorySpaceRemaining());
  }

  await move(getNearestMapLocation(Resource.mining));
  await craft(ItemCode.iron, getCraftableQuantity(ItemCode.iron));
}

/**
 * Go to the nearest iron rocks, mine iron ore
 */
export async function mineIron(): Promise<void> {
  await emptyInventoryIfFull();
  await move(getNearestMapLocation(Resource.iron_rocks));
  await gather();
}

/**
 * Mine iron ore and forge iron bars
 */
export async function mineAndForgeIron(): Promise<void> {
  // If we don't have enough iron ore to make 1 iron bar, mine enough to make 100
  while (!characterHasCraftingIngredients(ItemCode.iron, 100, true)) {
    await mineIron();
  }

  // While we have enough ingredients to make 1 iron bar, make it
  while (characterHasCraftingIngredients(ItemCode.iron, 1, true)) {
    await forgeIron();
  }
}

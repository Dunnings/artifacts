import { Action, EquipSlot, ItemCode, ItemToCraftingStation, ItemToResourceMap, Resource } from './enums';
import {
  characterAtLocation,
  characterHasCraftingIngredients,
  characterHasCraftingLevel,
  characterInventorySpaceRemaining,
  getNearestMapLocation,
  getCraftableQuantity,
  getCraftingRecipe,
  getItemCount,
} from './helper';
import { IApiActionResponse, ILocation } from './interfaces';
import { Model } from './model';
import { actionCall } from './network';
import { catchPromise, info, log, time, warn } from './util';

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
    throw error;
  }
  if (response.data === undefined) {
    warn(`Error: ${JSON.stringify(response)}`);
    throw error;
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

export async function craft(itemCode: ItemCode, quantity = 1): Promise<void> {
  const craftingStation = ItemToCraftingStation.get(itemCode);
  if (!craftingStation) {
    warn(`Item ${itemCode} is not a craftable resource`);
    return;
  }

  if (!characterHasCraftingIngredients(itemCode, quantity, true)) {
    warn(`Not enough materials to craft ${itemCode} (bank + inventory)`);
    return;
  }

  await emptyInventoryIfFull();

  let amountRemainingToCraft = quantity;
  let thisIterationCraftableQuantity: number;

  const craftingSpec = getCraftingRecipe(itemCode);
  const craftingItemQuantities = craftingSpec.items.map(item => item.quantity);
  const totalQuantity = craftingItemQuantities.reduce((acc, val) => acc + val, 0);

  while (amountRemainingToCraft > 0) {
    if (!characterHasCraftingIngredients(itemCode, amountRemainingToCraft)) {
      await move(getNearestMapLocation(Resource.bank));
      await depositAllItems();

      thisIterationCraftableQuantity = Math.floor(characterInventorySpaceRemaining() / totalQuantity);
      thisIterationCraftableQuantity = Math.min(getCraftableQuantity(itemCode, true), amountRemainingToCraft);

      for (const item of craftingSpec.items) {
        await withdraw(item.code, item.quantity * thisIterationCraftableQuantity);
      }
    }

    await move(getNearestMapLocation(craftingStation));
    await doActionAndWait(Action.crafting, { code: itemCode, quantity: thisIterationCraftableQuantity });

    amountRemainingToCraft -= thisIterationCraftableQuantity;
  }
}

export async function gather(item: ItemCode): Promise<void> {
  const resource = ItemToResourceMap.get(item);
  if (!resource) {
    warn(`Item ${item} is not a mineable resource`);
    return;
  }

  await emptyInventoryIfFull();
  await move(getNearestMapLocation(resource));
  await doActionAndWait(Action.gathering);
}

export async function gatherOrCraft(itemCode: ItemCode, quantity = 1, originalItem?: ItemCode): Promise<void> {
  if (originalItem !== undefined) {
    info(`Gathering or crafting ${quantity}x ${itemCode} to craft ${originalItem}`);
  }
  if (originalItem !== undefined && getItemCount(itemCode, true) >= quantity) {
    info(`Already have ${itemCode} x${quantity}`);
    return;
  }

  const craftingRecipe = getCraftingRecipe(itemCode);

  // pre-check ingredients
  if (craftingRecipe && !characterHasCraftingLevel(itemCode, true)) {
    warn(`Not enough skill to craft ${itemCode}`);
    return;
  }

  const itemResource = ItemToResourceMap.get(itemCode);

  if (itemResource) {
    //If the item is a resource, we can gather it
    while (getItemCount(itemCode, true) < quantity) {
      await gather(itemCode);
    }
  } else {
    // If the item is not a resource, we can't gather it, so we need to gather it's components
    for (const ingredient of craftingRecipe.items) {
      await gatherOrCraft(ingredient.code, ingredient.quantity * quantity, originalItem ?? itemCode);
    }
    await craft(itemCode, quantity);
  }
}

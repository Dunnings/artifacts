import { Action, EquipSlot, ItemCode, Resource } from './enums';
import {
  characterAtLocation,
  characterHasCraftingIngredients,
  characterInventorySpaceRemaining,
  getNearestMapLocation,
  getCraftableQuantity,
  getCraftingRecipe,
  getItemCount,
  createShoppingList,
  getCraftingStation,
  getResource,
  getGatherableResources,
} from './helper';
import { IApiActionResponse, ILocation } from './interfaces';
import { Model } from './model';
import { actionCall } from './network';
import { catchPromise, info, log, time, warn } from './util';

export async function waitForCooldown() {
  if (!Model.cooldownExpiration) return;
  const cooldown = new Date(Model.cooldownExpiration).getTime() - Date.now() + 1000;
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
}

export async function doActionAndWait(action: Action, data?: unknown): Promise<void> {
  await doAction(action, data);
  await waitForCooldown();
}

export async function depositAllItems(): Promise<void> {
  for (const item of Model.inventory) {
    if (item.quantity === 0) continue;
    log(`Depositing ${item.quantity}x ${item.code}`);
    await doActionAndWait(Action.deposit, { code: item.code, quantity: item.quantity });
  }
}

export async function equip(code: ItemCode, slot: EquipSlot) {
  log(`Equipping ${code} to ${slot}`);
  await doActionAndWait(Action.equip, { slot, code });
}

export async function unequip(slot: EquipSlot) {
  log(`Unequipping ${slot}`);
  await doActionAndWait(Action.unequip, { slot });
}

export async function rest() {
  log('Resting');
  await doActionAndWait(Action.rest);
}

export async function move(location: ILocation) {
  if (characterAtLocation(location)) return;
  log(`Moving to ${Model.maps.find(val => val.x === location.x && val.y === location.y)?.name ?? ''} (x: ${location.x}, y: ${location.y})`);
  await doActionAndWait(Action.move, location);
}

export async function withdraw(code: ItemCode, quantity: number) {
  await move(getNearestMapLocation(Resource.bank));
  log(`Withdrawing ${quantity}x ${code}`);
  await doActionAndWait(Action.withdraw, { code, quantity });
}

/**
 * Call this anytime you are going to add something to the inventory to prevent full errors
 */
export async function emptyInventory(onlyIfFull = true): Promise<void> {
  if (onlyIfFull && characterInventorySpaceRemaining() >= 3) return;
  await move(getNearestMapLocation(Resource.bank));
  await depositAllItems();
}

export async function craft(itemCode: ItemCode, quantity = 1): Promise<void> {
  const craftingStation = getCraftingStation(itemCode);
  if (!craftingStation) {
    warn(`Item ${itemCode} is not a craftable resource`);
    return;
  }

  if (!characterHasCraftingIngredients(itemCode, quantity, true)) {
    warn(`Not enough materials to craft ${itemCode} (bank + inventory)`);
    return;
  }

  await emptyInventory(false);

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
    log(`Crafting ${thisIterationCraftableQuantity}x ${itemCode}`);
    await doActionAndWait(Action.crafting, { code: itemCode, quantity: thisIterationCraftableQuantity });

    amountRemainingToCraft -= thisIterationCraftableQuantity;
  }
}

export async function gatherOrCraft(itemCode: ItemCode, quantity = 1): Promise<void> {
  info(`Gathering or crafting ${quantity}x ${itemCode}`);

  // Create a list of all the ingredients needed to craft the item
  const shoppingList = createShoppingList(itemCode, quantity);
  info(
    `Shopping list for ${quantity}x ${itemCode}: ${Object.keys(shoppingList)
      .map(key => `${shoppingList[key as ItemCode]}x ${key}`)
      .join(', ')}`,
  );

  // Gather all the ingredients needed to craft the item
  for (const ingredientCode of Object.keys(shoppingList) as ItemCode[]) {
    const quantity = shoppingList[ingredientCode];
    const needed = quantity - getItemCount(ingredientCode, true);
    while (getItemCount(ingredientCode, true) < needed) {
      await gather(ingredientCode);
    }
  }

  const craftingRecipe = getCraftingRecipe(itemCode);

  if (craftingRecipe) {
    await craft(itemCode, quantity);
  }
}

export async function gather(item: ItemCode, quantity = 1): Promise<void> {
  const resource = getResource(item);
  if (!resource) {
    warn(`Item ${item} is not a gatherable resource`);
    return;
  }

  for (let i = 0; i < quantity; i++) {
    await emptyInventory();
    await move(getNearestMapLocation(resource));
    log(`Gathering ${item}`);
    await doActionAndWait(Action.gathering);
  }
}

export async function gatherEverything(): Promise<void> {
  const gatherableResources = getGatherableResources();

  if (gatherableResources.length === 0) {
    warn('No gatherable resources found');
    return;
  }

  // only keep the highest of each skill
  const uniqueResources = gatherableResources.reduce((acc, val) => {
    if (acc.find(resource => resource.skill === val.skill)) {
      if (acc.find(resource => resource.skill === val.skill).level < val.level) {
        acc = acc.filter(resource => resource.skill !== val.skill);
        acc.push(val);
      }
    } else if (!acc.find(resource => resource.skill === val.skill)) {
      acc.push(val);
    }
    return acc;
  }, []);

  for (const resource of uniqueResources) {
    await emptyInventory(false);
    while (characterInventorySpaceRemaining() > 3) {
      await move(getNearestMapLocation(resource.code));
      log(`Gathering ${resource.code}`);
      await doActionAndWait(Action.gathering);
    }
  }
}

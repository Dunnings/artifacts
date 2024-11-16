import { IApiCharacterResponse, IBankAPIResponse, IBankItem, ICharacterData, IInventoryItem, IItem, IItemsAPIResponse, IMap, IMapAPIResponse } from './interfaces';
import { catchPromise } from './util';
import { bankItemsCall, characterCall, itemCall, mapCall } from './network';
import { gatherOrCraft, waitForCooldown } from './actions';
import { Model } from './model';
import { findCraftableItems, logQuantityDifferenceInItems } from './helper';
import { ItemCode } from './enums';

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

async function getBankItems(): Promise<IBankItem[]> {
  const items: IBankItem[] = [];
  let page = 1;
  let pages: number;
  do {
    const [response, error] = await catchPromise<IBankAPIResponse>(bankItemsCall(page));
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

// Common action macros

(async () => {
  // Standard actions
  Model.items = await getItems();
  Model.maps = await getMaps();
  Model.bankItems = await getBankItems();
  Model.character = await getCharacter();

  const beforeItems: (IInventoryItem | IBankItem)[] = JSON.parse(JSON.stringify([...Model.bankItems, ...Model.inventory]));

  findCraftableItems(true);

  // Wait for any outstanding cooldowns
  await waitForCooldown();

  // Main loop
  await gatherOrCraft(ItemCode.cooked_chicken, 1);

  // Log the difference in items
  Model.character = await getCharacter();
  Model.bankItems = await getBankItems();
  const afterItems = [...Model.bankItems, ...Model.inventory];
  logQuantityDifferenceInItems(beforeItems, afterItems);
})();

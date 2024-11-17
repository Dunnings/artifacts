import {
  IApiCharacterResponse,
  IBankAPIResponse,
  IBankItem,
  ICharacterData,
  IInventoryItem,
  IItem,
  IItemsAPIResponse,
  IMap,
  IMapAPIResponse,
  IMonster,
  IMonsterAPIResponse,
  IResource,
  IResourceAPIResponse,
} from './interfaces';
import { catchPromise } from './util';
import { bankItemsCall, characterCall, itemCall, mapCall, monsterCall, resourceCall } from './network';
import { gatherEverything, hunt, huntEverything, rest, waitForCooldown } from './actions';
import { Model } from './model';
import { findCraftableItems, findKillableMonsters, getResource, logQuantityDifferenceInItems } from './helper';
import { MonsterCode } from './enums';

async function fetchCharacter(): Promise<ICharacterData> {
  const [response, error] = await catchPromise<IApiCharacterResponse>(characterCall());
  if (error) return;
  return response.data;
}

async function fetchItems(): Promise<IItem[]> {
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

async function fetchResources(): Promise<IResource[]> {
  const items: IResource[] = [];
  let page = 1;
  let pages: number;
  do {
    const [response, error] = await catchPromise<IResourceAPIResponse>(resourceCall(page));
    if (error) return;
    response.data.forEach(element => {
      items.push(element);
    });
    pages = response.pages;
    page = response.page + 1;
  } while (page < pages);
  return items;
}

async function fetchMonsters(): Promise<IMonster[]> {
  const items: IMonster[] = [];
  let page = 1;
  let pages: number;
  do {
    const [response, error] = await catchPromise<IMonsterAPIResponse>(monsterCall(page));
    if (error) return;
    response.data.forEach((element: any) => {
      items.push(element);
    });
    pages = response.pages;
    page = response.page + 1;
  } while (page < pages);
  return items;
}

async function fetchBankItems(): Promise<IBankItem[]> {
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

async function fetchMaps(): Promise<Array<IMap>> {
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
  Model.items = await fetchItems();
  Model.maps = await fetchMaps();
  Model.bankItems = await fetchBankItems();
  Model.character = await fetchCharacter();
  Model.resources = await fetchResources();
  Model.monsters = await fetchMonsters();

  findCraftableItems(true);
  findKillableMonsters();

  // Wait for any outstanding cooldowns
  await waitForCooldown();

  while (true) {
    const beforeItems: (IInventoryItem | IBankItem)[] = JSON.parse(JSON.stringify([...Model.bankItems, ...Model.inventory]));

    await gatherEverything();
    await huntEverything();

    Model.character = await fetchCharacter();
    Model.bankItems = await fetchBankItems();
    const afterItems = [...Model.bankItems, ...Model.inventory];
    logQuantityDifferenceInItems(beforeItems, afterItems);
  }
})();

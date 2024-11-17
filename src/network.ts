import fetch from 'node-fetch';
import { config } from 'dotenv';
import {
  ICharacterData,
  IApiCharacterResponse,
  IItem,
  IItemsAPIResponse,
  IResource,
  IResourceAPIResponse,
  IMonster,
  IMonsterAPIResponse,
  IBankItem,
  IBankAPIResponse,
  IMap,
  IMapAPIResponse,
} from './interfaces';
import { catchPromise } from './util';

config();

const server = 'https://api.artifactsmmo.com';
const token = process.env.TOKEN;
const character = process.env.CHARACTER;
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Authorization': 'Bearer ' + token,
};
const options = { headers, method: 'POST' };

function createOptions(body?: string, method: 'POST' | 'GET' = 'POST') {
  const newOptions = { ...options, method };
  if (!body) return newOptions;
  return { ...newOptions, body };
}

function createActionURL(action: string) {
  return `${server}/my/${character}/action/${action}`;
}

export function actionCall(action: string, args?: any) {
  const options = createOptions(JSON.stringify(args));
  return fetch(createActionURL(action), options);
}

export function characterCall() {
  const options = createOptions(undefined, 'GET');
  return fetch(`${server}/characters/${character}`, options);
}

export function itemCall(page = 1) {
  const options = createOptions(undefined, 'GET');
  return fetch(`${server}/items?page=${page}`, options);
}

export function resourceCall(page = 1) {
  const options = createOptions(undefined, 'GET');
  return fetch(`${server}/resources?page=${page}`, options);
}

export function monsterCall(page = 1) {
  const options = createOptions(undefined, 'GET');
  return fetch(`${server}/monsters?page=${page}`, options);
}

export function bankItemsCall(page = 1) {
  const options = createOptions(undefined, 'GET');
  return fetch(`${server}/my/bank/items?page=${page}&size=100`, options);
}

export function mapCall(page = 1) {
  const options = createOptions(undefined, 'GET');
  return fetch(`${server}/maps?page=${page}&size=100`, options);
}

export async function fetchCharacter(): Promise<ICharacterData> {
  const [response, error] = await catchPromise<IApiCharacterResponse>(characterCall());
  if (error) return;
  return response.data;
}

export async function fetchItems(): Promise<IItem[]> {
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

export async function fetchResources(): Promise<IResource[]> {
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

export async function fetchMonsters(): Promise<IMonster[]> {
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

export async function fetchBankItems(): Promise<IBankItem[]> {
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

export async function fetchMaps(): Promise<Array<IMap>> {
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

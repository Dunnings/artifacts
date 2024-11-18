import fetch from 'node-fetch';
import { config } from 'dotenv';
import { catchPromise } from './util';
import {
  CharacterResponseSchema,
  CharacterSchema,
  DataPage_ItemSchema_,
  DataPage_MapSchema_,
  DataPage_MonsterSchema_,
  DataPage_ResourceSchema_,
  DataPage_SimpleItemSchema_,
  ItemSchema,
  MapSchema,
  MonsterSchema,
  ResourceSchema,
  SimpleItemSchema,
} from './client';

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

function createOptions(body?: Record<string, any>, method: 'POST' | 'GET' = 'POST') {
  const newOptions = { ...options, method };
  if (!body) return newOptions;
  return { ...newOptions, body: JSON.stringify(body) };
}

export async function fetchAPIResponse<T>(url: string, options?: any, method: 'POST' | 'GET' = 'POST'): Promise<T> {
  const fetchOptions = createOptions(options, method);
  try {
    const response = await fetch(url, fetchOptions);
    const json = await response.json();
    return json as T;
  } catch (error) {
    console.error(error);
    throw error;
  }
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

export async function fetchCharacter(): Promise<CharacterSchema> {
  const [response, error] = await catchPromise<CharacterResponseSchema>(characterCall());
  if (error) return;
  return response.data;
}

export async function fetchItems(): Promise<Array<ItemSchema>> {
  const items: ItemSchema[] = [];
  let page = 1;
  let pages: number;
  do {
    const [response, error] = await catchPromise<DataPage_ItemSchema_>(itemCall(page));
    if (error) return;
    response.data.forEach(element => {
      items.push(element);
    });
    pages = response.pages;
    page = response.page + 1;
  } while (page < pages);
  return items;
}

export async function fetchResources(): Promise<Array<ResourceSchema>> {
  const items: ResourceSchema[] = [];
  let page = 1;
  let pages: number;
  do {
    const [response, error] = await catchPromise<DataPage_ResourceSchema_>(resourceCall(page));
    if (error) return;
    response.data.forEach(element => {
      items.push(element);
    });
    pages = response.pages;
    page = response.page + 1;
  } while (page < pages);
  return items;
}

export async function fetchMonsters(): Promise<MonsterSchema[]> {
  const items: MonsterSchema[] = [];
  let page = 1;
  let pages: number;
  do {
    const [response, error] = await catchPromise<DataPage_MonsterSchema_>(monsterCall(page));
    if (error) return;
    response.data.forEach((element: any) => {
      items.push(element);
    });
    pages = response.pages;
    page = response.page + 1;
  } while (page < pages);
  return items;
}

export async function fetchBankItems(): Promise<Array<SimpleItemSchema>> {
  const items: SimpleItemSchema[] = [];
  let page = 1;
  let pages: number;
  do {
    const [response, error] = await catchPromise<DataPage_SimpleItemSchema_>(bankItemsCall(page));
    if (error) return;
    response.data.forEach(element => {
      items.push(element);
    });
    pages = response.pages;
    page = response.page + 1;
  } while (page < pages);
  return items;
}

export async function fetchMaps(): Promise<Array<MapSchema>> {
  const maps: MapSchema[] = [];
  let page = 1;
  let pages: number;
  do {
    const [response, error] = await catchPromise<DataPage_MapSchema_>(mapCall(page));
    if (error) return;
    response.data.forEach(element => {
      maps.push(element);
    });
    pages = response.pages;
    page = response.page + 1;
  } while (page < pages);
  return maps;
}

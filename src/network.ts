import fetch from 'node-fetch';
import { config } from 'dotenv';

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

export function bankItemsCall(page = 1) {
  const options = createOptions(undefined, 'GET');
  return fetch(`${server}/my/bank/items?page=${page}&size=100`, options);
}

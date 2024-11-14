import { ACTION, LOCATION } from './enums';
import { IApiActionResponse, IApiCharacterResponse, ICharacter, IErrorResponse } from './interfaces';
import { catchPromise, log } from './util';
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
  }
}

async function waitForCooldown() {
  if (!cooldownExpiration) return;
  const cooldown = new Date(cooldownExpiration).getTime() - Date.now();
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

async function doActionAndWait(action: string, args?: any) {
  await doAction(action, args);
  await waitForCooldown();
}

function characterIsAtLocation(location: { x: number; y: number }): boolean {
  return characterData.x === location.x && characterData.y === location.y;
}

// Common action macros

async function gatherAshWood() {
  if (!characterIsAtLocation(LOCATION.AshTree)) {
    await doActionAndWait(ACTION.Move, LOCATION.AshTree);
  }
  await doActionAndWait(ACTION.Gather);
}

async function craftWoodStaff() {
  if (!characterIsAtLocation(LOCATION.CraftingStation)) {
    await doActionAndWait(ACTION.Move, LOCATION.AshTree);
  }
  await doActionAndWait(ACTION.Craft, { code: 'wooden_staff' });
}

async function killChickens() {
  if (!characterIsAtLocation(LOCATION.Chickens)) {
    await doActionAndWait(ACTION.Move, LOCATION.Chickens);
  }
  await doActionAndWait(ACTION.Fight);
  await doActionAndWait(ACTION.Rest);
}

async function killCows() {
  if (!characterIsAtLocation(LOCATION.Cows)) {
    await doActionAndWait(ACTION.Move, LOCATION.Cows);
  }
  await doActionAndWait(ACTION.Fight);
  await doActionAndWait(ACTION.Rest);
}

async function unequipWeapon() {
  await doActionAndWait(ACTION.Unequip, { slot: 'weapon' });
}

async function equipWeapon() {
  await doActionAndWait(ACTION.Equip, { slot: 'weapon', code: 'wooden_staff' });
}

async function rest() {
  await doActionAndWait(ACTION.Rest);
}

(async () => {
  await getCharacter();
  await waitForCooldown();
  while (true) {
    await gatherAshWood();
  }
})();

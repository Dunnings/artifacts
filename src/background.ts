import { config } from 'dotenv';
import { World } from './world';
import { fetchItems, fetchMaps, fetchBankItems, fetchResources, fetchMonsters } from './network';
import { Character } from './character';

config();

// Standard actions

async function run() {
  await new Promise(resolve => setTimeout(resolve, Math.random() * 3000));
  World.init(await fetchBankItems(), await fetchItems(), await fetchMaps(), await fetchMonsters(), await fetchResources());

  const character = new Character();
  await character.init(process.env.CHARACTER);
  while (true) {
    await character.wait();
    await character.gatherEverything();
  }
}

try {
  run();
} catch (error) {
  console.error(error);
}

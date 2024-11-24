import { config } from 'dotenv';
import { World } from './world';
import { Character } from './character';

config();

async function run() {
  await World.init();

  const characters: Character[] = [];

  for (const characterName of process.env.BACKGROUND_CHARACTERS.split(',')) {
    const character = new Character();
    characters.push(character);
    await character.init(characterName);
  }

  let promises = [];

  promises = characters.map(async (character, index) => {
    while (true) {
      await character.depositInventoryIfFull(true);
      await character.gatherEverything(true, 'mining');
    }
  });

  await Promise.all(promises);
}

try {
  run();
} catch (error) {
  console.error(error);
}

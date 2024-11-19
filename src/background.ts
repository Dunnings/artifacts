import { config } from 'dotenv';
import { World } from './world';
import { Character } from './character';

config();

async function run() {
  await World.init();

  const characters: Character[] = [];

  for (const characterName of process.env.CHARACTERS.split(',')) {
    const character = new Character();
    characters.push(character);
    await character.init(characterName);
    await character.depositAllGearInBank();
  }

  for (const character of characters) {
    await character.equipBestGear();
  }

  const promises = characters.map(async (character, index) => {
    while (true) {
      await character.huntStrongest();
    }
  });

  await Promise.all(promises);
}

try {
  run();
} catch (error) {
  console.error(error);
}

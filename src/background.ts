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
  }

  // let promises = [];

  // promises = characters.map(async (character, index) => {
  //   await character.depositAllGearInBank();
  //   await character.depositInventoryIfFull(true);
  // });

  // await Promise.all(promises);

  for (const character of characters) {
    while (true) {
      await character.depositInventoryIfFull(true);
      await character.huntEverything(true);
    }
  }
}

try {
  run();
} catch (error) {
  console.error(error);
}

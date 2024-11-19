import { config } from 'dotenv';
import { World } from './world';
import { Character } from './character';

config();

async function run() {
  await World.init();

  const promises = process.env.CHARACTERS.split(',').map(async (characterName, index) => {
    await new Promise(resolve => setTimeout(resolve, index * 1000));
    const character = new Character();
    await character.init(characterName);
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

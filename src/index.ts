import inquirer from 'inquirer';
import InterruptedPrompt from 'inquirer-interrupted-prompt';
import chalk from 'chalk';
import { config } from 'dotenv';
import { CharacterSchema, ItemSlot } from './client';
import { Character } from './character';
import { World } from './world';
import * as fs from 'fs';
import * as path from 'path';

InterruptedPrompt.fromAll(inquirer);

config();

const characterNames = process.env.CHARACTERS.split(',');

const characterMap: Map<string, Character> = new Map();

const characterPromises: Map<string, Promise<unknown>> = new Map();

async function getCharacterName(): Promise<Array<Character>> {
  const availableCharacters = characterNames.filter(val => characterPromises.get(val) === undefined);

  const all = `All (${availableCharacters.join(', ')})`;

  const { characterName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'characterName',
      message: `Choose a character:`,
      choices: [all, ...availableCharacters],
    },
  ]);
  if (characterName === all) {
    return availableCharacters.map(val => characterMap.get(val));
  }
  return [characterMap.get(characterName)];
}

async function main(): Promise<boolean> {
  try {
    const promises = [...characterPromises.values()];
    if (!promises.some(val => val === undefined)) {
      await Promise.race([...characterPromises.values()].filter(val => val !== undefined));
    }
    const characters = await getCharacterName();
    const { command } = await inquirer.prompt([
      {
        type: 'list',
        name: 'command',
        message: 'Choose a command:',
        choices: ['craft', 'deposit', 'equip', 'gather', 'hunt', 'inventory', 'items', 'monsters', 'recycle', 'rest', 'suitup', 'unequip', 'withdraw', 'exit'],
      },
    ]);

    switch (command) {
      case 'craft':
        await craftChoice(characters);
        break;
      case 'deposit':
        await depositChoice(characters);
        break;
      case 'equip':
        await equipChoice(characters);
        break;
      case 'gather':
        await gatherChoice(characters);
        break;
      case 'hunt':
        await huntChoice(characters);
        break;
      case 'inventory':
        await inventoryChoice(characters);
        break;
      case 'items':
        await itemsChoice(characters);
        break;
      case 'monsters':
        await monstersChoice(characters);
        break;
      case 'recycle':
        await recycleChoice(characters);
        break;
      case 'rest':
        await restChoice(characters);
        break;
      case 'suitup':
        await equipBestGearChoice(characters);
        break;
      case 'unequip':
        await unequipChoice(characters);
        break;
      case 'withdraw':
        await withdrawChoice(characters);
        break;
      case 'exit':
        console.log('');
        break;
    }

    return command === 'exit';
  } catch (error) {
    console.log('');
    return true;
  }
}

async function inventoryChoice(characters: Array<Character>) {
  try {
    const { command } = await inquirer.prompt([
      {
        type: 'list',
        name: 'command',
        message: '[Inventory] Choose an inventory:',
        choices: ['player', 'bank', 'all'],
      },
    ]);

    for (const character of characters) {
      switch (command) {
        case 'player':
          console.log(
            World.allItems
              .filter(item => character.itemQuantity(item.code) > 1)
              .map(item => `${character.itemQuantity(item.code)}x ${item.code}`)
              .join('\n'),
          );
          break;
        case 'bank':
          console.log(
            World.bankItems
              .filter(item => item.quantity > 1)
              .map(item => `${item.quantity}x ${item.code}`)
              .join('\n'),
          );
          break;
        case 'all':
          console.log(
            World.allItems
              .filter(item => character.itemQuantity(item.code, true) > 1)
              .map(item => `${character.itemQuantity(item.code, true)}x ${item.code}`)
              .join('\n'),
          );
          break;
      }
    }
  } catch (e) {
    console.log('');
  }
}

async function monstersChoice(characters: Array<Character>) {
  try {
    const monsters = World.monsters.map(monster => {
      return {
        canKill: characters.map(char => char.canKill(monster)),
        monster,
      };
    });

    monsters.sort((a, b) => {
      if (a.canKill && !b.canKill) return -1;
      if (!a.canKill && b.canKill) return 1;
      return 0;
    });

    console.log(monsters.map(monster => `${monster.monster.code} - ${monster.canKill ? chalk.green('killable') : chalk.red('not killable')}`).join('\n'));
  } catch (error) {
    if (error === 'EVENT_INTERRUPTED') return;
    console.log(error);
  }
}

async function itemsChoice(characters: Array<Character>) {
  try {
    const items = [];

    for (const item of World.allItems) {
      const canEquipLevel = characters.every(character => character.canEquip(item.code));
      const canCraft = characters.every(character => character.canCraft(item.code, true));
      items.push({
        canEquipLevel,
        canCraft,
        item,
      });
    }

    items.sort((a, b) => {
      if (a.canEquipLevel && !b.canEquipLevel) return -1;
      if (a.canCraft && !b.canCraft) return -1;
      if (!a.canCraft && b.canCraft) return 1;
      return 0;
    });

    for (const item of items) {
      const desc = await World.getItemDescription(item.item.code, characters);
      console.log(desc);
    }
  } catch (error) {
    console.error(error);
    console.log(' ');
  }
}

async function craftChoice(characters: Array<Character>) {
  try {
    const items = [...new Set(...characters.map(character => character.getCraftableItems(true)))];

    const { itemCode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'itemCode',
        message: '[Craft] Choose item to craft:',
        choices: items,
      },
    ]);

    const maxQuantity = Math.floor(Math.max(...characters.map(character => character.getCraftableQuantity(itemCode, true))) / characters.length);

    const { quantity } = await inquirer.prompt([
      {
        type: 'number',
        name: 'quantity',
        message: `[Craft] Quantity (max ${maxQuantity}):`,
        default: 1,
        validate: val => {
          if (val > maxQuantity) {
            return `Quantity must be less than or equal to ${maxQuantity}`;
          }
          if (val < 0) {
            return 'Quantity must be greater than 0';
          }
          return true;
        },
      },
    ]);

    for (const character of characters) {
      const promise = character.craftItem(itemCode, quantity).then(() => characterPromises.set(character.name, undefined));
      characterPromises.set(character.name, promise);
    }
  } catch (error) {
    console.log(error);
  }
}

async function gatherChoice(characters: Array<Character>) {
  try {
    const resources = [...new Set(...characters.map(character => World.getAllGatherableResources(character).map(resource => resource.code)))];

    const { resourceCode, quantity } = await inquirer.prompt([
      {
        type: 'list',
        name: 'resourceCode',
        message: '[Gather] Choose resource to gather:',
        choices: resources,
      },
      {
        type: 'number',
        name: 'quantity',
        message: '[Gather] Quantity:',
        default: 1,
        validate: val => {
          if (val < 0) {
            return 'Quantity must be greater than 0';
          }
          return true;
        },
      },
    ]);

    for (const character of characters) {
      const promise = new Promise(async () => {
        await character.depositInventoryIfFull(true);
        for (let i = 0; i < quantity; i++) {
          await character.depositInventoryIfFull();
          await character.move(World.getNearestMapLocation(resourceCode, character));
          await character.gather();
        }
      }).then(() => characterPromises.set(character.name, undefined));
      characterPromises.set(character.name, promise);
    }
  } catch (error) {
    if (error === 'EVENT_INTERRUPTED') return;
    console.log(error);
  }
}

async function huntChoice(characters: Array<Character>) {
  try {
    const monsters = [...new Set(...characters.map(character => character.getHuntableMonsters()))];

    const { monsterCode, quantity } = await inquirer.prompt([
      {
        type: 'list',
        name: 'monsterCode',
        message: '[Hunt] Choose a monster to hunt:',
        choices: monsters,
      },
      {
        type: 'number',
        name: 'quantity',
        message: '[Hunt] Quantity:',
        default: 1,
        validate: val => {
          if (val < 0) {
            return 'Quantity must be greater than 0';
          }
          return true;
        },
      },
    ]);

    for (const character of characters) {
      const promise = character.huntMonster(monsterCode, quantity).then(() => characterPromises.set(character.name, undefined));
      characterPromises.set(character.name, promise);
    }
  } catch (error) {
    if (error === 'EVENT_INTERRUPTED') return;
    console.log(error);
  }
}

async function restChoice(characters: Array<Character>) {
  try {
    for (const character of characters) {
      const promise = character.rest().then(() => characterPromises.set(character.name, undefined));
      characterPromises.set(character.name, promise);
    }
  } catch (error) {
    if (error === 'EVENT_INTERRUPTED') return;
    console.log(error);
  }
}

async function recycleChoice(characters: Array<Character>) {
  try {
    const items = [...new Set(...characters.map(character => character.inventory.filter(item => item.quantity > 0).map(item => item.code)))];

    const { itemCode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'itemCode',
        message: '[Recycle] Choose an item to recycle:',
        choices: items,
      },
    ]);

    const minQuantity = Math.min(...characters.map(character => character.inventory.find(val => val.code === itemCode).quantity));

    const { quantity } = await inquirer.prompt([
      {
        type: 'number',
        name: 'quantity',
        message: `[Recycle] Quantity (max ${minQuantity}):`,
        default: 1,
        validate: val => {
          if (val > minQuantity) {
            return `Quantity must be less than or equal to ${minQuantity}`;
          }
          if (val < 0) {
            return 'Quantity must be greater than 0';
          }
          return true;
        },
      },
    ]);

    for (const character of characters) {
      const promise = character.recycleItem(itemCode, quantity).then(() => characterPromises.set(character.name, undefined));
      characterPromises.set(character.name, promise);
    }
  } catch (error) {
    if (error === 'EVENT_INTERRUPTED') return;
    console.log(error);
  }
}

async function equipChoice(characters: Array<Character>) {
  try {
    const options = [...new Set(...characters.map(character => character.inventory.filter(item => item.quantity > 0).map(item => item.code)))];

    const { itemCode, slot } = await inquirer.prompt([
      {
        type: 'list',
        name: 'itemCode',
        message: '[Equip] Choose an item to equip:',
        choices: options,
      },
      {
        type: 'list',
        name: 'slot',
        message: '[Equip] Choose a slot:',
        choices: Object.keys(characters[0].characterData)
          .filter(key => key.endsWith('_slot'))
          .map(val => val.replace('_slot', '') as ItemSlot),
      },
    ]);

    for (const character of characters) {
      if (character.characterData[(slot + '_slot') as keyof CharacterSchema] !== '') {
        await character.unequip(slot);
      }

      const promise = character.equip(itemCode, slot).then(() => characterPromises.set(character.name, undefined));
      characterPromises.set(character.name, promise);
    }
  } catch (error) {
    if (error === 'EVENT_INTERRUPTED') return;
    console.log(error);
  }
}

async function unequipChoice(characters: Array<Character>) {
  try {
    const choices = [
      ...new Set(
        ...characters.map(character =>
          Object.keys(character.characterData)
            .filter(key => key.endsWith('_slot'))
            .filter(key => character.characterData[key as keyof CharacterSchema] !== '')
            .map(key => key.replace('_slot', '') as ItemSlot),
        ),
      ),
    ];

    const { slot } = await inquirer.prompt([
      {
        type: 'list',
        name: 'slot',
        message: '[Unequip] Choose a slot:',
        choices,
      },
    ]);

    for (const character of characters) {
      await character.unequip(slot);
    }
  } catch (error) {
    if (error === 'EVENT_INTERRUPTED') return;
    console.log(error);
  }
}

async function depositChoice(characters: Array<Character>) {
  try {
    for (const character of characters) {
      const promise = character.depositInventoryIfFull(true).then(() => characterPromises.set(character.name, undefined));
      characterPromises.set(character.name, promise);
    }
  } catch (error) {
    if (error === 'EVENT_INTERRUPTED') return;
    console.log(error);
  }
}

async function withdrawChoice(characters: Array<Character>) {
  try {
    const { itemCode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'itemCode',
        message: '[Withdraw] Which item would you like to withdraw:',
        choices: World.bankItems.map(item => item.code),
      },
    ]);

    const minQuantity = Math.min(World.bankItems.find(val => val.code === itemCode).quantity, Math.min(...characters.map(character => character.inventorySlotsRemaining())));

    const { quantity } = await inquirer.prompt([
      {
        type: 'number',
        name: 'quantity',
        message: `[Withdraw] Quantity (max ${minQuantity}):`,
        default: 1,
        validate: val => {
          if (val > minQuantity) {
            return `Quantity must be less than or equal to ${minQuantity}`;
          }
          if (val < 0) {
            return 'Quantity must be greater than 0';
          }
          return true;
        },
      },
    ]);

    for (const character of characters) {
      const promise = character.withdraw(itemCode, quantity).then(() => characterPromises.set(character.name, undefined));
      characterPromises.set(character.name, promise);
    }
  } catch (error) {
    if (error === 'EVENT_INTERRUPTED') return;
    console.log(error);
  }
}

async function equipBestGearChoice(characters: Array<Character>) {
  try {
    for (const character of characters) {
      const promise = character.equipBestGear().then(() => characterPromises.set(character.name, undefined));
      characterPromises.set(character.name, promise);
    }
  } catch (error) {
    if (error === 'EVENT_INTERRUPTED') return;
    console.log(error);
  }
}

(async () => {
  const logFilePath = './action.log';
  fs.writeFileSync(logFilePath, '', 'utf-8');

  await World.init();

  await Promise.all(
    characterNames.map(async characterName => {
      const character = new Character();
      await character.init(characterName);
      characterMap.set(characterName, character);
      characterPromises.set(
        characterName,
        character.wait().then(() => {
          characterPromises.set(characterName, undefined);
        }),
      );
    }),
  );

  let exit = false;
  while (!exit) {
    exit = await main();
  }
})();

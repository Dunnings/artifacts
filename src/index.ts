import inquirer from 'inquirer';
import InterruptedPrompt from 'inquirer-interrupted-prompt';
import chalk from 'chalk';
import { config } from 'dotenv';
import { CharacterSchema, ItemSlot } from './client';
import { Character } from './character';
import { World } from './world';

InterruptedPrompt.fromAll(inquirer);

config();

const characterNames = process.env.CHARACTERS.split(',');

const characters: Character[] = [];

async function getCharacterName(choice: string): Promise<Character> {
  if (characters.length === 1) return characters[0];
  const { characterName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'command',
      message: `[${choice}] Choose a character:`,
      choices: characterNames,
    },
  ]);
  return characters.find(char => char.characterName === characterName);
}

async function main(): Promise<boolean> {
  try {
    const { command } = await inquirer.prompt([
      {
        type: 'list',
        name: 'command',
        message: 'Choose a command:',
        choices: ['craft', 'deposit', 'equip', 'gather', 'hunt', 'inventory', 'items', 'monsters', 'recycle', 'rest', 'unequip', 'withdraw', 'exit'],
      },
    ]);

    switch (command) {
      case 'craft':
        await craftChoice();
        break;
      case 'deposit':
        await depositChoice();
        break;
      case 'equip':
        await equipChoice();
        break;
      case 'gather':
        await gatherChoice();
        break;
      case 'hunt':
        await huntChoice();
        break;
      case 'inventory':
        await inventoryChoice();
        break;
      case 'items':
        await itemsChoice();
        break;
      case 'monsters':
        await monstersChoice();
        break;
      case 'recycle':
        await recycleChoice();
        break;
      case 'rest':
        await restChoice();
        break;
      case 'unequip':
        await unequipChoice();
        break;
      case 'withdraw':
        await withdrawChoice();
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

async function inventoryChoice() {
  try {
    const { command } = await inquirer.prompt([
      {
        type: 'list',
        name: 'command',
        message: '[Inventory] Choose an inventory:',
        choices: ['player', 'bank', 'all'],
      },
    ]);

    let character: Character;
    if (command === 'bank') {
      character = await getCharacterName('Inventory');
    }

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
  } catch (e) {
    console.log('');
  }
}

async function monstersChoice() {
  try {
    const character = await getCharacterName('Monster');

    const monsters = World.monsters.map(monster => {
      return {
        canKill: character.canKill(monster),
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
    console.log('');
  }
}

async function itemsChoice() {
  try {
    const character = await getCharacterName('Items');

    const items = World.allItems.map(item => {
      return {
        isCraftable: item.craft !== undefined,
        highEnoughLevel: character.hasCraftingLevel(item.code),
        canCraft: item.craft !== undefined && character.canCraft(item.code, true),
        item,
      };
    });

    items.sort((a, b) => {
      if (a.canCraft && !b.canCraft) return -1;
      if (!a.canCraft && b.canCraft) return 1;
      if (a.highEnoughLevel && !b.highEnoughLevel) return -1;
      return 0;
    });

    console.log(
      items
        .map(item => `${item.item.code} - ${item.highEnoughLevel ? chalk.green('✅ level') : chalk.red('❌ level')} ${item.canCraft ? chalk.green('✅ ingredients') : chalk.red('❌ ingredients')}`)
        .join('\n'),
    );
  } catch (error) {
    console.log(' ');
  }
}

async function craftChoice() {
  try {
    const character = await getCharacterName('Craft');
    const items = World.allItems.filter(item => character.canCraft(item.code, true));

    const { itemCode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'itemCode',
        message: '[Craft] Choose item to craft:',
        choices: items.map(item => item.code),
      },
    ]);

    const maxQuantity = character.getCraftableQuantity(itemCode, true);

    const { quantity } = await inquirer.prompt([
      {
        type: 'number',
        name: 'quantity',
        message: `[Craft] Quantity (max ${maxQuantity}):`,
        default: 1,
      },
    ]);

    await character.craftItem(itemCode, quantity);
  } catch (error) {
    console.log('');
  }
}

async function gatherChoice() {
  try {
    const character = await getCharacterName('Gather');
    const resources = World.getAllGatherableResources(character);

    const { resourceCode, quantity } = await inquirer.prompt([
      {
        type: 'list',
        name: 'resourceCode',
        message: '[Gather] Choose resource to gather:',
        choices: resources.map(resource => resource.code),
      },
      {
        type: 'number',
        name: 'quantity',
        message: '[Gather] Quantity:',
        default: 1,
      },
    ]);

    await character.depositInventoryIfFull(true);
    for (let i = 0; i < quantity; i++) {
      await character.depositInventoryIfFull();
      await character.move(World.getNearestMapLocation(resourceCode, character));
      await character.gather();
    }
  } catch (error) {
    console.log('');
  }
}

async function huntChoice() {
  try {
    const character = await getCharacterName('Hunt');
    const monsters = character.getHuntableMonsters();

    const { monsterCode, quantity } = await inquirer.prompt([
      {
        type: 'list',
        name: 'monsterCode',
        message: '[Hunt] Choose a monster to hunt:',
        choices: monsters.map(monster => monster.code),
      },
      {
        type: 'number',
        name: 'quantity',
        message: '[Hunt] Quantity:',
        default: 1,
      },
    ]);

    await character.huntMonster(monsterCode, quantity);
  } catch (error) {
    console.log('');
  }
}

async function restChoice() {
  try {
    const character = await getCharacterName('Rest');
    await character.rest();
  } catch (error) {
    console.log('');
  }
}

async function recycleChoice() {
  try {
    const character = await getCharacterName('Recycle');

    const { itemCode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'itemCode',
        message: '[Recycle] Choose an item to recycle:',
        choices: character.inventory.map(item => item.code),
      },
    ]);

    const { quantity } = await inquirer.prompt([
      {
        type: 'number',
        name: 'quantity',
        message: `[Recycle] Quantity (max ${character.inventory.find(item => item.code === itemCode).quantity}):`,
        default: 1,
      },
    ]);

    await character.recycleItem(itemCode, quantity);
  } catch (error) {
    console.log('');
  }
}

async function equipChoice() {
  try {
    const character = await getCharacterName('Equip');

    const { itemCode, slot } = await inquirer.prompt([
      {
        type: 'list',
        name: 'itemCode',
        message: '[Equip] Choose an item to equip:',
        choices: character.inventory.map(item => item.code),
      },
      {
        type: 'list',
        name: 'slot',
        message: '[Equip] Choose a slot:',
        choices: Object.keys(character.characterData)
          .filter(key => key.endsWith('_slot'))
          .map(val => val.replace('_slot', '') as ItemSlot),
      },
    ]);

    if (character.characterData[(slot + '_slot') as keyof CharacterSchema] !== '') {
      await character.unequip(slot);
    }

    await character.equip(itemCode, slot);
  } catch (error) {
    console.log('');
  }
}

async function unequipChoice() {
  try {
    const character = await getCharacterName('Unequip');

    const { slot } = await inquirer.prompt([
      {
        type: 'list',
        name: 'slot',
        message: '[Unequip] Choose a slot:',
        choices: Object.keys(character.characterData)
          .filter(key => key.endsWith('_slot'))
          .filter(key => character.characterData[key as keyof CharacterSchema] !== '')
          .map(key => key.replace('_slot', '') as ItemSlot),
      },
    ]);

    await character.unequip(slot);
  } catch (error) {
    console.log('');
  }
}

async function depositChoice() {
  try {
    const character = await getCharacterName('Deposit');
    await character.depositInventoryIfFull(true);
  } catch (error) {
    console.log('');
  }
}

async function withdrawChoice() {
  try {
    const character = await getCharacterName('Withdraw');

    const { itemCode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'itemCode',
        message: '[Withdraw] Which item would you like to withdraw:',
        choices: World.bankItems.map(item => item.code),
      },
    ]);

    const { quantity } = await inquirer.prompt([
      {
        type: 'number',
        name: 'quantity',
        message: `[Withdraw] Quantity (max ${Math.min(World.bankItems.find(val => val.code === itemCode).quantity, character.inventorySlotsRemaining())}):`,
        default: 1,
      },
    ]);

    await character.withdraw(itemCode, quantity);
  } catch (error) {
    console.log('');
  }
}

(async () => {
  await World.init();

  for (const characterName of characterNames) {
    const character = new Character();
    await character.init(characterName);
    characters.push(character);
  }

  let exit = false;
  while (!exit) {
    exit = await main();
  }
})();

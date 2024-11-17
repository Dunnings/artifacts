import { fetchBankItems, fetchCharacter, fetchItems, fetchMaps, fetchMonsters, fetchResources } from './network';
import { Model } from './model';
import { canCraft, canKill, characterHasCraftingLevel, getAllGatherableResources, getItemCount, getNearestMapLocation } from './helper';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { craft, doActionAndWait, emptyInventory, gather, move, rest, waitForCooldown } from './actions';
import { log } from './util';
import { Action } from './enums';

async function main(): Promise<boolean> {
  const { command } = await inquirer.prompt([
    {
      type: 'list',
      name: 'command',
      message: 'Choose a command:',
      choices: ['inventory', 'items', 'monsters', 'gather', 'craft', 'rest', 'exit'],
    },
  ]);

  switch (command) {
    case 'inventory':
      await inventoryChoice();
      break;
    case 'craft':
      await craftChoice();
      break;
    case 'gather':
      await gatherChoice();
      break;
    case 'monsters':
      await monstersChoice();
      break;
    case 'items':
      await itemsChoice();
      break;
    case 'rest':
      await restChoice();
      break;
    case 'exit':
      console.log('');
      break;
  }

  return command === 'exit';
}

async function inventoryChoice() {
  const { command } = await inquirer.prompt([
    {
      type: 'list',
      name: 'command',
      message: '[Inventory] Choose a command:',
      choices: ['player', 'player + bank'],
    },
  ]);

  switch (command) {
    case 'player':
      console.log(
        Model.items
          .filter(item => getItemCount(item.code) > 1)
          .map(item => `${getItemCount(item.code)}x ${item.code}`)
          .join('\n'),
      );
      break;
    case 'player + bank':
      console.log(
        Model.items
          .filter(item => getItemCount(item.code, true) > 1)
          .map(item => `${getItemCount(item.code, true)}x ${item.code}`)
          .join('\n'),
      );
      break;
  }
}

async function monstersChoice() {
  const monsters = Model.monsters.map(monster => {
    return {
      canKill: canKill(monster),
      monster,
    };
  });

  monsters.sort((a, b) => {
    if (a.canKill && !b.canKill) return -1;
    if (!a.canKill && b.canKill) return 1;
    return 0;
  });

  console.log(monsters.map(monster => `${monster.monster.code} - ${monster.canKill ? chalk.green('killable') : chalk.red('not killable')}`).join('\n'));
}

async function itemsChoice() {
  const items = Model.items.map(item => {
    return {
      isCraftable: item.craft !== undefined,
      highEnoughLevel: characterHasCraftingLevel(item.code),
      canCraft: item.craft !== undefined && canCraft(item.code, true),
      item,
    };
  });

  items.sort((a, b) => {
    if (a.canCraft && !b.canCraft) return -1;
    if (!a.canCraft && b.canCraft) return 1;
    return 0;
  });

  console.log(items.map(item => `${item.item.code} - ${item.canCraft ? chalk.green('craftable') : chalk.red('not craftable')}`).join('\n'));
}

async function craftChoice() {
  const items = Model.items.filter(item => canCraft(item.code, true));

  const { itemCode, quantity } = await inquirer.prompt([
    {
      type: 'list',
      name: 'itemCode',
      message: 'Choose item to craft:',
      choices: items.map(item => item.code),
    },
    {
      type: 'number',
      name: 'quantity',
      message: 'Quantity:',
      default: 1,
    },
  ]);

  await waitForCooldown();
  await craft(itemCode, quantity);
}

async function gatherChoice() {
  const resources = getAllGatherableResources();

  const { resourceCode, quantity } = await inquirer.prompt([
    {
      type: 'list',
      name: 'resourceCode',
      message: 'Choose resource to gather:',
      choices: resources.map(resource => resource.code),
    },
    {
      type: 'number',
      name: 'quantity',
      message: 'Quantity:',
      default: 1,
    },
  ]);

  await emptyInventory(false);
  for (let i = 0; i < quantity; i++) {
    await move(getNearestMapLocation(resourceCode));
    log(`Gathering ${resourceCode}`);
    await doActionAndWait(Action.gathering);
  }
}

async function restChoice(): Promise<void> {
  await rest();
}

// Common action macros

(async () => {
  // Standard actions
  Model.character = await fetchCharacter();
  Model.bankItems = await fetchBankItems();
  Model.items = await fetchItems();
  Model.maps = await fetchMaps();
  Model.resources = await fetchResources();
  Model.monsters = await fetchMonsters();

  let exit = false;
  while (!exit) {
    exit = await main();
  }
})();

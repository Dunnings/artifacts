// import inquirer from 'inquirer';
// import InterruptedPrompt from 'inquirer-interrupted-prompt';
// import chalk from 'chalk';
// import { fetchBankItems, fetchCharacter, fetchItems, fetchMaps, fetchMonsters, fetchResources } from './network';
// import { log } from './util';
// import { CharacterSchema, ItemSlot } from './client';

// InterruptedPrompt.fromAll(inquirer);

// async function main(): Promise<boolean> {
//   try {
//     const { command } = await inquirer.prompt([
//       {
//         type: 'list',
//         name: 'command',
//         message: 'Choose a command:',
//         choices: ['craft', 'deposit', 'equip', 'gather', 'hunt', 'inventory', 'items', 'monsters', 'recycle', 'rest', 'unequip', 'withdraw', 'exit'],
//       },
//     ]);

//     switch (command) {
//       case 'craft':
//         await craftChoice();
//         break;
//       case 'deposit':
//         await depositChoice();
//         break;
//       case 'equip':
//         await equipChoice();
//         break;
//       case 'gather':
//         await gatherChoice();
//         break;
//       case 'hunt':
//         await huntChoice();
//         break;
//       case 'inventory':
//         await inventoryChoice();
//         break;
//       case 'items':
//         await itemsChoice();
//         break;
//       case 'monsters':
//         await monstersChoice();
//         break;
//       case 'recycle':
//         await recycleChoice();
//         break;
//       case 'rest':
//         await restChoice();
//         break;
//       case 'unequip':
//         await unequipChoice();
//         break;
//       case 'withdraw':
//         await withdrawChoice();
//         break;
//       case 'exit':
//         console.log('');
//         break;
//     }

//     return command === 'exit';
//   } catch (error) {
//     console.log('');
//     return true;
//   }
// }

// async function inventoryChoice() {
//   try {
//     const { command } = await inquirer.prompt([
//       {
//         type: 'list',
//         name: 'command',
//         message: '[Inventory] Choose an inventory:',
//         choices: ['player', 'bank', 'all'],
//       },
//     ]);

//     switch (command) {
//       case 'player':
//         console.log(
//           Model.allItems
//             .filter(item => getItemCount(item.code) > 1)
//             .map(item => `${getItemCount(item.code)}x ${item.code}`)
//             .join('\n'),
//         );
//         break;
//       case 'bank':
//         console.log(
//           Model.allItems
//             .filter(item => getItemCount(item.code, true) - getItemCount(item.code) > 1)
//             .map(item => `${getItemCount(item.code, true) - getItemCount(item.code)}x ${item.code}`)
//             .join('\n'),
//         );
//         break;
//       case 'all':
//         console.log(
//           Model.allItems
//             .filter(item => getItemCount(item.code, true) > 1)
//             .map(item => `${getItemCount(item.code, true)}x ${item.code}`)
//             .join('\n'),
//         );
//         break;
//     }
//   } catch (e) {
//     console.log('');
//   }
// }

// async function monstersChoice() {
//   const monsters = Model.monsters.map(monster => {
//     return {
//       canKill: canKill(monster),
//       monster,
//     };
//   });

//   monsters.sort((a, b) => {
//     if (a.canKill && !b.canKill) return -1;
//     if (!a.canKill && b.canKill) return 1;
//     return 0;
//   });

//   console.log(monsters.map(monster => `${monster.monster.code} - ${monster.canKill ? chalk.green('killable') : chalk.red('not killable')}`).join('\n'));
// }

// async function itemsChoice() {
//   const items = Model.allItems.map(item => {
//     return {
//       isCraftable: item.craft !== undefined,
//       highEnoughLevel: characterHasCraftingLevel(item.code),
//       canCraft: item.craft !== undefined && canCraft(item.code, true),
//       item,
//     };
//   });

//   items.sort((a, b) => {
//     if (a.canCraft && !b.canCraft) return -1;
//     if (!a.canCraft && b.canCraft) return 1;
//     if (a.highEnoughLevel && !b.highEnoughLevel) return -1;
//     return 0;
//   });

//   console.log(
//     items
//       .map(item => `${item.item.code} - ${item.highEnoughLevel ? chalk.green('✅ level') : chalk.red('❌ level')} ${item.canCraft ? chalk.green('✅ ingredients') : chalk.red('❌ ingredients')}`)
//       .join('\n'),
//   );
// }

// async function craftChoice() {
//   try {
//     const items = Model.allItems.filter(item => canCraft(item.code, true));

//     const { itemCode } = await inquirer.prompt([
//       {
//         type: 'list',
//         name: 'itemCode',
//         message: '[Craft] Choose item to craft:',
//         choices: items.map(item => item.code),
//       },
//     ]);

//     const maxQuantity = getCraftableQuantity(itemCode, true);

//     const { quantity } = await inquirer.prompt([
//       {
//         type: 'number',
//         name: 'quantity',
//         message: `[Craft] Quantity (max ${maxQuantity}):`,
//         default: 1,
//       },
//     ]);

//     await waitForCooldown();
//     await waitForCooldown();
//     await craft(itemCode, quantity);
//   } catch (error) {
//     console.log('');
//   }
// }

// async function gatherChoice() {
//   try {
//     const resources = getAllGatherableResources();

//     const { resourceCode, quantity } = await inquirer.prompt([
//       {
//         type: 'list',
//         name: 'resourceCode',
//         message: '[Gather] Choose resource to gather:',
//         choices: resources.map(resource => resource.code),
//       },
//       {
//         type: 'number',
//         name: 'quantity',
//         message: '[Gather] Quantity:',
//         default: 1,
//       },
//     ]);

//     await waitForCooldown();
//     await emptyInventory(false);
//     for (let i = 0; i < quantity; i++) {
//       await move(getNearestMapLocation(resourceCode));
//       log(`Gathering ${resourceCode}`);
//       await doActionAndWait('gathering');
//     }
//   } catch (error) {
//     console.log('');
//   }
// }

// async function huntChoice() {
//   try {
//     const monsters = findKillableMonsters();

//     const { monsterCode, quantity } = await inquirer.prompt([
//       {
//         type: 'list',
//         name: 'monsterCode',
//         message: '[Hunt] Choose a monster to hunt:',
//         choices: monsters.map(monster => monster.code),
//       },
//       {
//         type: 'number',
//         name: 'quantity',
//         message: '[Hunt] Quantity:',
//         default: 1,
//       },
//     ]);

//     await waitForCooldown();
//     await hunt(monsterCode, quantity);
//   } catch (error) {
//     console.log('');
//   }
// }

// async function restChoice() {
//   await waitForCooldown();
//   await rest();
// }

// async function recycleChoice() {
//   try {
//     const { itemCode } = await inquirer.prompt([
//       {
//         type: 'list',
//         name: 'itemCode',
//         message: '[Recycle] Choose an item to recycle:',
//         choices: Model.inventory.map(item => item.code),
//       },
//     ]);

//     const { quantity } = await inquirer.prompt([
//       {
//         type: 'number',
//         name: 'quantity',
//         message: `[Recycle] Quantity (max ${Model.inventory.find(item => item.code === itemCode).quantity}):`,
//         default: 1,
//       },
//     ]);

//     await waitForCooldown();
//     await recycle(itemCode, quantity);
//   } catch (error) {
//     console.log('');
//   }
// }

// async function equipChoice() {
//   try {
//     const { itemCode, slot } = await inquirer.prompt([
//       {
//         type: 'list',
//         name: 'itemCode',
//         message: '[Equip] Choose an item to equip:',
//         choices: Model.inventory.map(item => item.code),
//       },
//       {
//         type: 'list',
//         name: 'slot',
//         message: '[Equip] Choose a slot:',
//         choices: Object.keys(Model.character)
//           .filter(key => key.endsWith('_slot'))
//           .map(val => val.replace('_slot', '') as ItemSlot),
//       },
//     ]);

//     if (Model.character[(slot + '_slot') as keyof CharacterSchema] !== '') {
//       await waitForCooldown();
//       await unequip(slot);
//     }

//     await waitForCooldown();
//     await equip(itemCode, slot);
//   } catch (error) {
//     console.log('');
//   }
// }

// async function unequipChoice() {
//   try {
//     const { slot } = await inquirer.prompt([
//       {
//         type: 'list',
//         name: 'slot',
//         message: '[Unequip] Choose a slot:',
//         choices: Object.keys(Model.character)
//           .filter(key => key.endsWith('_slot'))
//           .filter(key => Model.character[key as keyof CharacterSchema] !== '')
//           .map(key => key.replace('_slot', '') as ItemSlot),
//       },
//     ]);

//     await waitForCooldown();
//     await unequip(slot);
//   } catch (error) {
//     console.log('');
//   }
// }

// async function depositChoice() {
//   await waitForCooldown();
//   await emptyInventory(false);
// }

// async function withdrawChoice() {
//   try {
//     const { itemCode } = await inquirer.prompt([
//       {
//         type: 'list',
//         name: 'itemCode',
//         message: '[Withdraw] Which item would you like to withdraw:',
//         choices: Model.bankItems.map(item => item.code),
//       },
//     ]);

//     const { quantity } = await inquirer.prompt([
//       {
//         type: 'number',
//         name: 'quantity',
//         message: `[Withdraw] Quantity (max ${Math.min(Model.bankItems.find(val => val.code === itemCode).quantity, characterInventorySpaceRemaining())}):`,
//         default: 1,
//       },
//     ]);

//     await waitForCooldown();
//     await withdraw(itemCode, quantity);
//   } catch (error) {
//     console.log('');
//   }
// }

// (async () => {
//   Model.initializeModelData(await fetchBankItems(), await fetchCharacter(), await fetchItems(), await fetchMaps(), await fetchMonsters(), await fetchResources());

//   let exit = false;
//   while (!exit) {
//     exit = await main();
//   }
// })();

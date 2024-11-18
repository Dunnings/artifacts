// export async function craft(itemCode: string, quantity = 1): Promise<void> {
//   const craftingStation = getCraftingSkill(itemCode);
//   if (!craftingStation) {
//     warn(`Item ${itemCode} is not a craftable resource`);
//     return;
//   }

//   if (!characterHasCraftingIngredients(itemCode, quantity, true)) {
//     warn(`Not enough materials to craft ${itemCode} (bank + inventory)`);
//     return;
//   }

//   await emptyInventory(false);

//   let amountRemainingToCraft = quantity;
//   let thisIterationCraftableQuantity: number;

//   const craftingSpec = getCraftingRecipe(itemCode); // 1 gudgeon
//   const craftingItemQuantities = craftingSpec.items.map(item => item.quantity); // [1]
//   const totalQuantity = craftingItemQuantities.reduce((acc, val) => acc + val, 0); // 1

//   const maxCraftableQuantity = Math.floor(Model.character.inventory_max_items / totalQuantity);

//   while (amountRemainingToCraft > 0) {
//     if (!characterHasCraftingIngredients(itemCode, maxCraftableQuantity)) {
//       await move(getNearestMapLocation('bank'));
//       await depositAllItems();

//       thisIterationCraftableQuantity = Math.min(getCraftableQuantity(itemCode, true), maxCraftableQuantity);
//       thisIterationCraftableQuantity = Math.min(thisIterationCraftableQuantity, amountRemainingToCraft);

//       for (const item of craftingSpec.items) {
//         await withdraw(item.code, item.quantity * thisIterationCraftableQuantity);
//       }
//     }

//     await move(getNearestMapLocation(craftingStation));
//     log(`Crafting ${thisIterationCraftableQuantity}x ${itemCode}`);
//     await doActionAndWait('crafting', { code: itemCode, quantity: thisIterationCraftableQuantity });

//     amountRemainingToCraft -= thisIterationCraftableQuantity;
//   }
// }

// export async function gatherOrCraft(itemCode: string, quantity = 1): Promise<void> {
//   info(`Gathering or crafting ${quantity}x ${itemCode}`);

//   // Create a list of all the ingredients needed to craft the item
//   const shoppingList = createShoppingList(itemCode, quantity);
//   info(
//     `Shopping list for ${quantity}x ${itemCode}: ${Object.keys(shoppingList)
//       .map(key => `${shoppingList[key as string]}x ${key}`)
//       .join(', ')}`,
//   );

//   // Gather all the ingredients needed to craft the item
//   for (const ingredientCode of Object.keys(shoppingList) as string[]) {
//     const quantity = shoppingList[ingredientCode];
//     const needed = quantity - getItemCount(ingredientCode, true);
//     while (getItemCount(ingredientCode, true) < needed) {
//       await gather(ingredientCode);
//     }
//   }

//   const craftingRecipe = getCraftingRecipe(itemCode);

//   if (craftingRecipe) {
//     await craft(itemCode, quantity);
//   }
// }

// export function getCraftableQuantity(itemCode: string, includeBankInventory = false): number {
//   const craftingSpec = getCraftingRecipe(itemCode);
//   if (!craftingSpec) {
//     warn(`Item ${itemCode} is not craftable`);
//     return 0;
//   }
//   if (!characterHasCraftingLevel(itemCode)) {
//     warn(`Skill level too low to craft ${itemCode}. Required: ${craftingSpec.level}. Current: ${Model.character[`${craftingSpec.skill}_level`]}`);
//     return 0;
//   }
//   const maxCraftable = craftingSpec.items.reduce((acc, craftingIngredient) => {
//     const quantity = Math.floor(getItemCount(craftingIngredient.code, includeBankInventory) / craftingIngredient.quantity);
//     return quantity < acc ? quantity : acc;
//   }, Infinity);
//   return maxCraftable;
// }

// export function createShoppingList(itemCode: string, quantity: number = 1, shoppingList?: Record<string, number>): Record<string, number> {
//   const isTopLevel = shoppingList === undefined;
//   if (isTopLevel) shoppingList = {} as Record<string, number>;

//   const craftingSpec = getCraftingRecipe(itemCode);
//   if (!craftingSpec || (!isTopLevel && getItemCount(itemCode, true) > quantity)) {
//     if (!shoppingList[itemCode]) shoppingList[itemCode] = 0;
//     shoppingList[itemCode] = shoppingList[itemCode] + quantity;
//     return shoppingList;
//   }

//   for (const craftingItem of craftingSpec.items) {
//     shoppingList = createShoppingList(craftingItem.code, craftingItem.quantity * quantity, shoppingList);
//   }

//   return shoppingList;
// }



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

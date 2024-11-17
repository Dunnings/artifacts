import { waitForCooldown, gatherEverything, huntEverything } from './actions';
import { findCraftableItems, findKillableMonsters, logQuantityDifferenceInItems } from './helper';
import { IInventoryItem, IBankItem } from './interfaces';
import { Model } from './model';
import { fetchItems, fetchMaps, fetchBankItems, fetchCharacter, fetchResources, fetchMonsters } from './network';

// Standard actions
Model.items = await fetchItems();
Model.maps = await fetchMaps();
Model.bankItems = await fetchBankItems();
Model.character = await fetchCharacter();
Model.resources = await fetchResources();
Model.monsters = await fetchMonsters();

// Wait for any outstanding cooldowns
await waitForCooldown();

while (true) {
  Model.character = await fetchCharacter();
  Model.bankItems = await fetchBankItems();

  const beforeItems: (IInventoryItem | IBankItem)[] = JSON.parse(JSON.stringify([...Model.bankItems, ...Model.inventory]));

  await gatherEverything();
  await huntEverything();

  Model.character = await fetchCharacter();
  Model.bankItems = await fetchBankItems();
  const afterItems = [...Model.bankItems, ...Model.inventory];
  logQuantityDifferenceInItems(beforeItems, afterItems);
}

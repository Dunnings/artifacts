import {
  ActionGatheringMyNameActionGatheringPostResponse,
  CharacterFightResponseSchema,
  CharacterMovementResponseSchema,
  CharacterResponseSchema,
  CharacterRestResponseSchema,
  CharacterSchema,
  CraftSkill,
  GatheringSkill,
  InventorySlot,
  MonsterSchema,
  SkillResponseSchema,
  TaskResponseSchema,
  XY,
  ItemSlot,
  SimpleItemSchema,
  Skill,
} from './client';
import { World } from './world';
import { fetchAPIResponse } from './network';
import { info, log, warn } from './util';

const SERVER_URL = 'https://api.artifactsmmo.com';

export class Character {
  public characterData: CharacterSchema;
  public name: string;

  public async init(characterName: string) {
    this.name = characterName;
    const data = await fetchAPIResponse<CharacterResponseSchema>(`${SERVER_URL}/characters/${this.name}`, undefined, 'GET');
    this.characterData = data.data;
  }

  public get cooldownExpiration(): string {
    return this.characterData.cooldown_expiration;
  }

  public get hp(): number {
    return this.characterData.hp;
  }

  public get location(): XY {
    return { x: this.characterData.x, y: this.characterData.y };
  }

  public get maxHP(): number {
    return this.characterData.max_hp;
  }

  public get inventory(): Array<InventorySlot> {
    return this.characterData.inventory;
  }

  // Basic actions

  public async wait() {
    if (!this.cooldownExpiration) return;
    const cooldown = new Date(this.cooldownExpiration).getTime() - Date.now() + 1000;
    if (cooldown <= 0) return;
    return new Promise(resolve => setTimeout(resolve, cooldown));
  }

  public async rest() {
    if (this.hp === this.maxHP) return;
    await this.wait();
    const data = await fetchAPIResponse<CharacterRestResponseSchema>(`${SERVER_URL}/my/${this.name}/action/rest`);
    this.characterData = data.data.character;
    log(`${this.name} restored ${data.data.hp_restored} hp`);
  }

  public async equip(code: string, slot: ItemSlot, quantity = 1) {
    await this.wait();
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.name}/action/equip`, { code, slot, quantity });
    this.characterData = data.data.character;
    log(`${this.name} equipped ${code} to ${slot}`);
  }

  public async recycle(code: string, quantity: string) {
    await this.wait();
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.name}/action/recycling`, { code, quantity });
    this.characterData = data.data.character;
    log(`${this.name} recycled ${quantity}x ${code}`);
  }

  public async gather() {
    await this.wait();
    const data = await fetchAPIResponse<SkillResponseSchema>(`${SERVER_URL}/my/${this.name}/action/gathering`);
    this.characterData = data.data.character;
    log(`${this.name} gathered ${data.data.details.items.map(item => `${item.quantity}x ${item.code}`).join(', ')} (${data.data.details.xp} xp)`);
  }

  public async fight() {
    await this.wait();
    const data = await fetchAPIResponse<CharacterFightResponseSchema>(`${SERVER_URL}/my/${this.name}/action/fight`);
    this.characterData = data.data.character;
    log(`${this.name} ${data.data.fight.result === 'win' ? 'won' : 'lost'} a fight (${data.data.fight.xp} xp)`);
  }

  public async unequip(slot: ItemSlot) {
    if (!this.characterData[(slot + '_slot') as keyof CharacterSchema]) return;
    await this.wait();
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.name}/action/unequip`, { slot });
    this.characterData = data.data.character;
    log(`${this.name} unequipped ${slot}`);
  }

  public async withdraw(code: string, quantity: number) {
    await this.wait();
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.name}/action/bank/withdraw`, { code, quantity });
    await World.updateBank();
    this.characterData = data.data.character;
    log(`${this.name} withdrew ${quantity}x ${code}`);
  }

  public async withdrawGold(quantity: number) {
    await this.wait();
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.name}/action/bank/withdraw/gold`, { quantity });
    await World.updateBank();
    this.characterData = data.data.character;
    log(`${this.name} withdrew ${quantity}x gold`);
  }

  public async deposit(code: string, quantity: number) {
    await this.wait();
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.name}/action/bank/deposit`, { code, quantity });
    await World.updateBank();
    this.characterData = data.data.character;
    log(`${this.name} deposited ${quantity}x ${code}`);
  }

  public async depositGold(quantity: number) {
    await this.wait();
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.name}/action/bank/deposit/gold`, { quantity });
    await World.updateBank();
    this.characterData = data.data.character;
    log(`${this.name} deposited ${quantity}x gold`);
  }

  public async move(location: XY) {
    if (this.isAtLocation(location)) return;

    await this.wait();
    const data = await fetchAPIResponse<CharacterMovementResponseSchema>(`${SERVER_URL}/my/${this.name}/action/move`, location);
    this.characterData = data.data.character;
    const contentCode = data.data.destination.content?.code;
    log(`${this.name} moved to ${data.data.destination.name}${contentCode ? ` [${contentCode}] ` : ' '}(x: ${location.x} y: ${location.y})`);
  }

  public async craft(code: string, quantity: number) {
    await this.wait();
    const data = await fetchAPIResponse<SkillResponseSchema>(`${SERVER_URL}/my/${this.name}/action/crafting`, { code, quantity });
    this.characterData = data.data.character;
    log(`${this.name} crafted ${quantity}x ${code}`);
  }

  /**
   * More advanced functions
   */

  public async recycleItem(item: string, quantity: string) {
    const craftingStation = World.getCraftingSkill(item);

    if (!craftingStation) {
      warn(`Item ${item} is not a recyclable resource`);
      return;
    }

    await this.move(World.getNearestMapLocation(craftingStation, this));
    await this.recycle(item, quantity);
  }

  public async depositInventoryIfFull(force = false) {
    if (!force && this.inventorySlotsRemaining() > 5) return;
    for (const item of this.inventory) {
      if (item.quantity === 0) continue;
      await this.move(World.getNearestMapLocation('bank', this));
      await this.deposit(item.code, item.quantity);
    }
  }

  public async huntMonster(code: string, quantity = 1) {
    for (let i = 0; i < quantity; i++) {
      await this.depositInventoryIfFull();
      await this.move(World.getNearestMapLocation(code, this));
      await this.rest();
      await this.fight();
    }
  }

  public async gatherItem(code: string, quantity = 1) {
    const resource = World.getItemResource(code, this);

    for (let i = 0; i < quantity; i++) {
      await this.depositInventoryIfFull();
      await this.move(World.getNearestMapLocation(resource, this));
      await this.gather();
    }
  }

  public async huntEverything(onlyStrongest = true): Promise<void> {
    let killableMonsters = this.getHuntableMonsters();
    killableMonsters.sort((a, b) => b.level - a.level);

    if (killableMonsters.length === 0) {
      warn('No killable monsters found');
      return;
    }

    if (onlyStrongest) {
      killableMonsters = [killableMonsters[0]];
    }

    await this.depositInventoryIfFull(true);

    for (const monster of killableMonsters) {
      while (this.inventorySlotsRemaining() > 5) {
        await this.move(World.getNearestMapLocation(monster.code, this));
        await this.rest();
        await this.fight();
      }
    }
  }

  public async gatherEverything(highestPerSkill = true, limitSkill?: Skill): Promise<void> {
    let allGatherableResources = World.getAllGatherableResources(this);

    if (limitSkill) {
      allGatherableResources = allGatherableResources.filter(val => val.skill === limitSkill);
    }

    if (allGatherableResources.length === 0) {
      warn('No gatherable resources found');
      return;
    }

    if (highestPerSkill) {
      allGatherableResources = allGatherableResources.reduce((acc, val) => {
        const existingResource = acc.find(val => val.skill === val.skill);
        if (existingResource) {
          if (existingResource.level < val.level) {
            acc = acc.filter(resource => resource.skill !== val.skill);
            acc.push(val);
          }
        } else {
          acc.push(val);
        }
        return acc;
      }, []);
    }

    await this.depositInventoryIfFull(true);

    for (const resource of allGatherableResources) {
      while (this.inventorySlotsRemaining() > 5) {
        await this.move(World.getNearestMapLocation(resource.code, this));
        await this.rest();
        await this.gather();
      }
    }
  }

  public async depositAllGoldInBank() {
    if (this.gold() === 0) return;
    await this.move(World.getNearestMapLocation('bank', this));
    await this.depositGold(this.gold());
  }

  public async withdrawAllGoldInBank() {
    if (World.bank.gold === 0) return;
    await this.move(World.getNearestMapLocation('bank', this));
    await this.withdrawGold(World.bank.gold);
  }

  public async craftItem(itemCode: string, quantity = 1, recursive = true): Promise<void> {
    const craftingStation = World.getCraftingSkill(itemCode);
    if (!craftingStation) {
      return;
    }

    if (!this.hasCraftingIngredients(itemCode, quantity, true, false)) {
      const ingredients = World.getCraftingRecipe(itemCode).items;
      for (const ingredient of ingredients) {
        await this.craftItem(ingredient.code, ingredient.quantity * quantity, recursive);
      }
    }

    await this.depositInventoryIfFull(true);

    let amountRemainingToCraft = quantity;
    let thisIterationCraftableQuantity: number;

    const craftingSpec = World.getCraftingRecipe(itemCode); // 1 gudgeon
    const craftingItemQuantities = craftingSpec.items.map(item => item.quantity); // [1]
    const totalQuantity = craftingItemQuantities.reduce((acc, val) => acc + val, 0); // 1

    const maxCraftableQuantity = Math.floor(this.characterData.inventory_max_items / totalQuantity);

    while (amountRemainingToCraft > 0) {
      if (!this.hasCraftingIngredients(itemCode, maxCraftableQuantity, false, false)) {
        await this.move(World.getNearestMapLocation('bank', this));
        await this.depositInventoryIfFull(true);

        thisIterationCraftableQuantity = Math.min(this.getCraftableQuantity(itemCode, true), maxCraftableQuantity);
        thisIterationCraftableQuantity = Math.min(thisIterationCraftableQuantity, amountRemainingToCraft);

        for (const item of craftingSpec.items) {
          await this.withdraw(item.code, item.quantity * thisIterationCraftableQuantity);
        }
      }

      await this.move(World.getNearestMapLocation(craftingStation, this));
      await this.craft(itemCode, thisIterationCraftableQuantity);

      amountRemainingToCraft -= thisIterationCraftableQuantity;
    }
  }

  public async depositAllGearInBank() {
    const itemSlots = Object.keys(this.characterData)
      .filter(key => key.endsWith('_slot'))
      .map(val => val.replace('_slot', '') as ItemSlot);

    for (const slot of itemSlots) {
      await this.depositInventoryIfFull();
      await this.unequip(slot);
    }

    await this.depositInventoryIfFull(true);
  }

  public async equipBestGear() {
    await this.depositAllGearInBank();
    await World.updateBank();

    const itemSlots = Object.keys(this.characterData)
      .filter(key => key.endsWith('_slot'))
      .map(val => val.replace('_slot', '') as ItemSlot);

    for (const slot of itemSlots) {
      const slotWithoutNumber = slot.replace(/\d/g, '');
      const availableItems = World.bankItems.filter(item => World.allItems.find(val => val.code === item.code).type === slotWithoutNumber).filter(item => this.canEquip(item.code));
      const bestItem = availableItems.sort((a, b) => {
        const aLevel = World.getItemLevel(a.code);
        const bLevel = World.getItemLevel(b.code);
        if (aLevel === bLevel) {
          const aTotal = World.allItems.find(val => val.code === a.code).effects.reduce((acc, val) => val.value + acc, 0);
          const bTotal = World.allItems.find(val => val.code === b.code).effects.reduce((acc, val) => val.value + acc, 0);
          return bTotal - aTotal;
        }
        return bLevel - aLevel;
      })[0];

      if (!bestItem) {
        continue;
      }

      let quantity = 1;
      if (slotWithoutNumber === 'utility') {
        quantity = Math.min(100, this.itemQuantity(bestItem.code, true));
      }
      await this.withdraw(bestItem.code, quantity);
      await this.equip(bestItem.code, slot, quantity);
    }
  }

  public async gatherOrCraft(itemCode: string, quantity = 1): Promise<void> {
    // Create a list of all the ingredients needed to craft the item
    const shoppingList = this.createShoppingList(itemCode, quantity);
    info(
      `Shopping list for ${quantity}x ${itemCode}: ${Object.keys(shoppingList)
        .map(key => `${shoppingList[key as string]}x ${key}`)
        .join(', ')}`,
    );

    // Gather all the ingredients needed to craft the item
    for (const ingredientCode of Object.keys(shoppingList) as string[]) {
      const quantity = shoppingList[ingredientCode];
      const needed = quantity - this.itemQuantity(ingredientCode, true);
      while (this.itemQuantity(ingredientCode, true) < needed) {
        await this.gatherItem(ingredientCode);
      }
    }

    const craftingRecipe = World.getCraftingRecipe(itemCode);

    if (craftingRecipe) {
      await this.craftItem(itemCode, quantity);
    }
  }

  /**
   * Private getters
   */

  public skillLevel(skill: GatheringSkill | CraftSkill): number {
    return this.characterData[`${skill}_level` as keyof CharacterSchema] as number;
  }

  public inventorySlotsRemaining(): number {
    return this.characterData.inventory_max_items - this.inventory.reduce((acc, val) => acc + val.quantity, 0);
  }

  public isAtLocation(location: XY) {
    return this.characterData.x === location.x && this.characterData.y === location.y;
  }

  public itemQuantity(itemCode: string, includeBank = false): number {
    const inventoryQuantity = this.inventory.find(val => val.code === itemCode)?.quantity ?? 0;
    const bankQuantity = World.bankItems.find(val => val.code === itemCode)?.quantity ?? 0;
    if (includeBank) return inventoryQuantity + bankQuantity;
    return inventoryQuantity;
  }

  public gold(): number {
    return this.characterData.gold;
  }

  public hasItem(itemCode: string, quantity = 1, includeBank = false): boolean {
    return this.itemQuantity(itemCode, includeBank) >= quantity;
  }

  public hasCraftingLevel(itemCode: string): boolean {
    const craftingSpec = World.getCraftingRecipe(itemCode);
    if (craftingSpec?.items) {
      return this.skillLevel(craftingSpec.skill) >= craftingSpec.level && craftingSpec.items.every(item => this.hasCraftingLevel(item.code) !== false);
    }
  }

  public hasCraftingIngredients(itemCode: string, quantity = 1, includeBank = true, recursive = true, itemDatabase?: Map<string, number>): boolean {
    let isFirstCall = false;
    if (!itemDatabase) {
      isFirstCall = true;
      itemDatabase = new Map();
      this.inventory.forEach(item => itemDatabase.set(item.code, item.quantity));
      if (includeBank) {
        World.bankItems.forEach(item => {
          const itemCount = itemDatabase.has(item.code) ? itemDatabase.get(item.code) : 0;
          itemDatabase.set(item.code, itemCount + item.quantity);
        });
      }
    }

    const craftingSpec = World.getCraftingRecipe(itemCode);

    const databaseQuantity = itemDatabase.get(itemCode) ?? 0;

    // if it's a base item, return if we have enough of the base item
    if (!craftingSpec) {
      itemDatabase.set(itemCode, databaseQuantity - quantity);
      return databaseQuantity >= quantity;
    }

    // if it's a crafted item and we have enough of it, return true
    if (!isFirstCall && databaseQuantity >= quantity) {
      itemDatabase.set(itemCode, databaseQuantity - quantity);
      return true;
    }

    // if it's a crafted item and we don't have enough of it, check if we have enough of the ingredients
    return craftingSpec.items.every(ingredient => {
      const ingredientCraftingSpec = World.getCraftingRecipe(ingredient.code);
      const databaseQuantity = itemDatabase.get(ingredient.code) ?? 0;
      if (databaseQuantity >= ingredient.quantity * quantity) {
        itemDatabase.set(ingredient.code, databaseQuantity - ingredient.quantity * quantity);
        return true;
      }
      if (ingredientCraftingSpec && recursive) {
        return this.hasCraftingIngredients(ingredient.code, ingredient.quantity * quantity, includeBank, recursive, itemDatabase) !== false;
      }
      return false;
    });
  }

  public canCraft(itemCode: string, includeBank = true, recursive = true, itemDatabase?: Map<string, number>): boolean {
    if (!World.getCraftingRecipe(itemCode)) return;
    return this.hasCraftingLevel(itemCode) && this.hasCraftingIngredients(itemCode, 1, includeBank, recursive, itemDatabase);
  }

  public canEquip(itemCode: string): boolean {
    return this.characterData.level >= World.getItemLevel(itemCode);
  }

  public getCraftableItems(includeBank = true): Array<string> {
    return World.itemCodes.filter(item => this.canCraft(item, includeBank));
  }

  public canKill(monster: MonsterSchema): boolean {
    const player_health = this.characterData.max_hp;
    const player_attack_fire = this.characterData.attack_fire;
    const player_attack_earth = this.characterData.attack_earth;
    const player_attack_water = this.characterData.attack_water;
    const player_attack_air = this.characterData.attack_air;
    const player_res_fire = this.characterData.res_fire;
    const player_res_earth = this.characterData.res_earth;
    const player_res_water = this.characterData.res_water;
    const player_res_air = this.characterData.res_air;
    const monster_health = monster.hp;
    const monster_attack_fire = monster.attack_fire;
    const monster_attack_earth = monster.attack_earth;
    const monster_attack_water = monster.attack_water;
    const monster_attack_air = monster.attack_air;
    const monster_res_fire = monster.res_fire;
    const monster_res_earth = monster.res_earth;
    const monster_res_water = monster.res_water;
    const monster_res_air = monster.res_air;

    let temp_player_health = player_health;
    let temp_monster_health = monster_health;

    while (temp_player_health > 0 && temp_monster_health > 0) {
      temp_monster_health -= Math.max(0, player_attack_fire * (1 + this.characterData.dmg_fire * 0.01) * (1 - monster_res_fire * 0.01));
      temp_monster_health -= Math.max(0, player_attack_earth * (1 + this.characterData.dmg_earth * 0.01) * (1 - monster_res_earth * 0.01));
      temp_monster_health -= Math.max(0, player_attack_water * (1 + this.characterData.dmg_water * 0.01) * (1 - monster_res_water * 0.01));
      temp_monster_health -= Math.max(0, player_attack_air * (1 + this.characterData.dmg_air * 0.01) * (1 - monster_res_air * 0.01));

      temp_player_health -= Math.max(0, monster_attack_fire * (1 - player_res_fire * 0.01));
      temp_player_health -= Math.max(0, monster_attack_earth * (1 - player_res_earth * 0.01));
      temp_player_health -= Math.max(0, monster_attack_water * (1 - player_res_water * 0.01));
      temp_player_health -= Math.max(0, monster_attack_air * (1 - player_res_air * 0.01));
    }

    return temp_player_health > 0;
  }

  public getHuntableMonsters(): Array<MonsterSchema> {
    return World.monsters.filter(monster => this.canKill(monster));
  }

  public getCraftableQuantity(itemCode: string, includeBankInventory = false): number {
    const craftingSpec = World.getCraftingRecipe(itemCode);
    if (!craftingSpec) {
      warn(`Item ${itemCode} is not craftable`);
      return 0;
    }
    if (!this.hasCraftingLevel(itemCode)) {
      warn(`Skill level too low to craft ${itemCode}. Required: ${craftingSpec.level}. Current: ${this.characterData[`${craftingSpec.skill}_level`]}`);
      return 0;
    }
    const maxCraftable = craftingSpec.items.reduce((acc, craftingIngredient) => {
      const quantity = Math.floor(this.itemQuantity(craftingIngredient.code, includeBankInventory) / craftingIngredient.quantity);
      return quantity < acc ? quantity : acc;
    }, Infinity);
    return maxCraftable;
  }

  public createShoppingList(itemCode: string, quantity: number = 1, shoppingList?: Record<string, number>): Record<string, number> {
    const isTopLevel = shoppingList === undefined;
    if (isTopLevel) shoppingList = {} as Record<string, number>;

    const craftingSpec = World.getCraftingRecipe(itemCode);
    if (!craftingSpec || (!isTopLevel && this.itemQuantity(itemCode, true) > quantity)) {
      if (!shoppingList[itemCode]) shoppingList[itemCode] = 0;
      shoppingList[itemCode] = shoppingList[itemCode] + quantity;
      return shoppingList;
    }

    for (const craftingItem of craftingSpec.items) {
      shoppingList = this.createShoppingList(craftingItem.code, craftingItem.quantity * quantity, shoppingList);
    }

    return shoppingList;
  }
}

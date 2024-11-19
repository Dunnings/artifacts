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
} from './client';
import { World } from './world';
import { fetchAPIResponse } from './network';
import { log, time, warn } from './util';

const SERVER_URL = 'https://api.artifactsmmo.com';

export type CharacterAction = 'fight' | 'move' | 'rest' | 'gathering' | 'crafting' | 'unequip' | 'equip' | 'recycling';

export class Character {
  private characterName: string;
  private characterData: CharacterSchema;

  public async init(characterName: string) {
    this.characterName = characterName;
    const data = await fetchAPIResponse<CharacterResponseSchema>(`${SERVER_URL}/characters/${this.characterName}`, undefined, 'GET');
    this.characterData = data.data;
    await this.wait();
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
    const data = await fetchAPIResponse<CharacterRestResponseSchema>(`${SERVER_URL}/my/${this.characterName}/action/rest`);
    this.characterData = data.data.character;
    log(`[${this.characterName}] Restored ${data.data.hp_restored} hp`);
    await this.wait();
  }

  public async equip(code: string, slot: string) {
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.characterName}/action/equip`, { code, slot });
    this.characterData = data.data.character;
    log(`[${this.characterName}] Equipped ${code} to ${slot}`);
    await this.wait();
  }

  public async recycle(code: string, quantity: string) {
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.characterName}/action/recycle`, { code, quantity });
    this.characterData = data.data.character;
    log(`[${this.characterName}] Recycled ${quantity}x ${code}`);
    await this.wait();
  }

  public async gather() {
    const data = await fetchAPIResponse<SkillResponseSchema>(`${SERVER_URL}/my/${this.characterName}/action/gathering`);
    this.characterData = data.data.character;
    log(`[${this.characterName}] Gathered ${data.data.details.items.map(item => `${item.quantity}x ${item.code}`).join(', ')} (${data.data.details.xp} xp)`);
    await this.wait();
  }

  public async fight() {
    const data = await fetchAPIResponse<CharacterFightResponseSchema>(`${SERVER_URL}/my/${this.characterName}/action/fight`);
    this.characterData = data.data.character;
    log(`[${this.characterName}] ${data.data.fight.result === 'win' ? 'Won' : 'Lost'} a fight (${data.data.fight.xp} xp)`);
    await this.wait();
  }

  public async unequip(slot: string) {
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.characterName}/action/unequip`, { slot });
    this.characterData = data.data.character;
    log(`[${this.characterName}] Unequipped ${slot}`);
    await this.wait();
  }

  public async withdraw(code: string, quantity: number) {
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.characterName}/action/bank/withdraw`, { code, quantity });
    this.characterData = data.data.character;
    log(`[${this.characterName}] Withdrew ${quantity}x ${code}`);
    await this.wait();
  }

  public async withdrawGold(quantity: number) {
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.characterName}/action/bank/withdraw/gold`, { quantity });
    this.characterData = data.data.character;
    log(`[${this.characterName}] Withdrew ${quantity}x gold`);
    await this.wait();
  }

  public async deposit(code: string, quantity: number) {
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.characterName}/action/bank/deposit`, { code, quantity });
    this.characterData = data.data.character;
    log(`[${this.characterName}] Deposited ${quantity}x ${code}`);
    await this.wait();
  }

  public async depositGold(quantity: number) {
    const data = await fetchAPIResponse<TaskResponseSchema>(`${SERVER_URL}/my/${this.characterName}/action/bank/deposit/gold`, { quantity });
    this.characterData = data.data.character;
    log(`[${this.characterName}] Deposited ${quantity}x gold`);
    await this.wait();
  }

  public async move(location: XY) {
    if (this.isAtLocation(location)) return;

    const data = await fetchAPIResponse<CharacterMovementResponseSchema>(`${SERVER_URL}/my/${this.characterName}/action/move`, location);
    this.characterData = data.data.character;
    const contentCode = data.data.destination.content?.code;
    log(`[${this.characterName}] Moved to ${data.data.destination.name}${contentCode ? ` [${contentCode}] ` : ' '}(x: ${location.x} y: ${location.y})`);
    await this.wait();
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
      await this.wait();
      await this.deposit(item.code, item.quantity);
      await this.wait();
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
    const resource = World.getItemResource(code);

    for (let i = 0; i < quantity; i++) {
      await this.depositInventoryIfFull();
      await this.move(World.getNearestMapLocation(resource, this));
      await this.gather();
    }
  }

  public async huntStrongest(): Promise<void> {
    const killableMonsters = this.getHuntableMonsters();
    killableMonsters.sort((a, b) => b.level - a.level);

    if (killableMonsters.length === 0) {
      warn('No killable monsters found');
      return;
    }

    await this.depositInventoryIfFull(true);

    while (this.inventorySlotsRemaining() > 5) {
      await this.move(World.getNearestMapLocation(killableMonsters[0].code, this));
      await this.rest();
      await this.fight();
    }
  }

  public async huntEverything(): Promise<void> {
    const killableMonsters = this.getHuntableMonsters();
    killableMonsters.sort((a, b) => b.level - a.level);

    if (killableMonsters.length === 0) {
      warn('No killable monsters found');
      return;
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

  public async gatherEverything(highestPerSkill = true): Promise<void> {
    let allGatherableResources = World.getAllGatherableResources(this);

    if (allGatherableResources.length === 0) {
      warn('No gatherable resources found');
      return;
    }

    if (highestPerSkill) {
      allGatherableResources = allGatherableResources.reduce((acc, val) => {
        if (acc.find(resource => resource.skill === val.skill)) {
          if (acc.find(resource => resource.skill === val.skill).level < val.level) {
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
    const inventoryQuantity = this.inventory.find(item => item.code === itemCode)?.quantity ?? 0;
    const bankQuantity = World.bankItems.find(item => item.code === itemCode)?.quantity ?? 0;
    if (includeBank) return inventoryQuantity + bankQuantity;
    return inventoryQuantity;
  }

  public gold(): number {
    return this.characterData.gold;
  }

  public hasItem(itemCode: string, quantity = 1, includeBank = false): boolean {
    return this.itemQuantity(itemCode, includeBank) >= quantity;
  }

  public hasCraftingIngredients(itemCode: string, quantity = 1, includeBank = false): boolean {
    const craftingSpec = World.getCraftingRecipe(itemCode);
    return craftingSpec.items.every(item => this.itemQuantity(item.code, includeBank) >= item.quantity * quantity);
  }

  public hasCraftingLevel(itemCode: string, iterative = false): boolean {
    const craftingSpec = World.getCraftingRecipe(itemCode);

    if (!craftingSpec) return;

    if (iterative && craftingSpec?.items) {
      return craftingSpec.items.every(item => this.hasCraftingLevel(item.code, true) !== false);
    }

    return this.skillLevel(craftingSpec.skill) >= craftingSpec.level;
  }

  public canCraft(itemCode: string, includeBank = false): boolean {
    if (!World.getCraftingRecipe(itemCode)) return false;
    return this.hasCraftingLevel(itemCode) && this.hasCraftingIngredients(itemCode, 1, includeBank);
  }

  public getCraftableItems(includeBank = false): Array<string> {
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
}
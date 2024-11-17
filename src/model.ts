import { IBankItem, ICharacterData, IInventoryItem, IItem, IMap, IResource } from './interfaces';

export class Model {
  public static character: ICharacterData;
  public static items: IItem[];
  public static bankItems: IBankItem[];
  public static maps: IMap[];
  public static resources: IResource[];

  public static get inventory(): IInventoryItem[] {
    return Model.character.inventory;
  }

  public static get cooldownExpiration(): string {
    return Model.character.cooldown_expiration;
  }

  public static get inventoryMaxItems(): number {
    return Model.character.inventory_max_items;
  }
}

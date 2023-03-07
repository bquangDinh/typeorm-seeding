import { ClassConstructor, ExtractFactory, FactoryOptions, FactoryOptionsOverrides } from './types'

import { SaveOptions } from 'typeorm'
import { SeedingSource } from './seeding-source'
import { isPromiseLike } from './utils/is-promise-like.util'
import { resolveFactory } from './utils/resolve-factory.util'

/**
 * Factory
 */
export abstract class Factory<Entity> {
  /**
   * Options
   */
  protected options: FactoryOptions<Entity> = {}

  get seedingSource() {
    if (this.optionOverrides.seedingSource instanceof SeedingSource) {
      return this.optionOverrides.seedingSource
    } else {
      throw new Error(`SeedingSource options was not set for Factory ${Object.getPrototypeOf(this).name}`)
    }
  }

  set seedingSource(seedingSource: SeedingSource) {
    this.optionOverrides.seedingSource = seedingSource
  }

  get overrides(): ClassConstructor<Factory<any>> | undefined {
    return this.optionOverrides.override ?? this.options.override ?? Object.getPrototypeOf(this).constructor
  }

  /**
   * Mapping function.
   *
   * @private
   */
  private mapFunction?: (entity: Entity) => Promise<void> | void

  /**
   * Constructor
   *
   * @param optionOverrides option overrides
   */
  constructor(private optionOverrides: FactoryOptionsOverrides<Entity> = {}) {}

  /**
   * Return an instance of entity.
   *
   * @param entity An instance of the configured entity (if provided in options)
   */
  protected async entity(entity?: Entity): Promise<Entity> {
    if (entity) {
      return entity
    } else {
      throw new Error('No entity was found in Factory options, so you must override the `entity` method')
    }
  }

  /**
   * Finalize the instance of entity.
   *
   * This method is called after all maps and overrides have been applied
   *
   * @param entity An instance of the entity
   */
  protected async finalize(entity: Entity): Promise<void> {} // eslint-disable-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function

  /**
   * This function is used to alter the generated values of entity,
   * before it is persisted to the database.
   */
  map(mapFunction: (entity: Entity) => Promise<void> | void) {
    this.mapFunction = mapFunction
    return this
  }

  /**
   * Make a new entity without persisting it
   */
  async make(overrideParams: Partial<Entity> = {}): Promise<Entity> {
    return this.makeEntity(overrideParams, false)
  }

  /**
   * Make many new entities without persisting it
   */
  async makeMany(amount: number, overrideParams: Partial<Entity> = {}): Promise<Entity[]> {
    const list = []
    for (let index = 0; index < amount; index++) {
      list[index] = await this.make(overrideParams)
    }
    return list
  }

  /**
   * Create a new entity and persist it
   */
  async create(overrideParams: Partial<Entity> = {}, saveOptions?: SaveOptions): Promise<Entity> {
    // make the entity
    const entity = await this.makeEntity(overrideParams, true, saveOptions)
    // save it
    return this.save(entity, saveOptions)
  }

  /**
   * Persist one entity
   */
  async save(entity: Entity, saveOptions?: SaveOptions): Promise<Entity>

  /**
   * Persist many entities
   */
  async save(entities: Entity[], saveOptions?: SaveOptions): Promise<Entity[]>

  /**
   * Persist one or many entities
   */
  async save(entities: Entity | Entity[], saveOptions?: SaveOptions): Promise<Entity | Entity[]> {
    const dataSource = await this.seedingSource.dataSource

    // has been initialized yet?
    if (!dataSource.isInitialized) {
      // no, initialize it
      await dataSource.initialize()
    }

    return dataSource.createEntityManager().save(entities, saveOptions)
  }

  /**
   * Create many new entities and persist them
   */
  async createMany(amount: number, overrideParams: Partial<Entity> = {}, saveOptions?: SaveOptions): Promise<Entity[]> {
    const list = []
    for (let index = 0; index < amount; index++) {
      list[index] = await this.create(overrideParams, saveOptions)
    }
    return list
  }

  private entityClass(): ClassConstructor<Entity> | undefined {
    return this.optionOverrides?.entity ? this.optionOverrides.entity : this.options.entity
  }

  private async makeEntity(
    overrideParams: Partial<Entity>,
    persist: boolean,
    saveOptions?: SaveOptions,
  ): Promise<Entity> {
    const entityClass = this.entityClass()

    const entity = await this.entity(entityClass ? new entityClass() : undefined)

    if (this.mapFunction) {
      await this.mapFunction(entity)
    }

    for (const key in overrideParams) {
      const actualValue = entity[key]
      entity[key] = overrideParams[key] as typeof actualValue
    }

    const resolvedEntity = await this.resolveEntity(entity, persist, saveOptions)

    await this.finalize(resolvedEntity)

    return resolvedEntity
  }

  private async resolveEntity(entity: Entity, persist: boolean, saveOptions?: SaveOptions): Promise<Entity> {
    for (const attribute in entity) {
      const attributeValue = entity[attribute]

      if (isPromiseLike(attributeValue)) {
        entity[attribute] = await attributeValue
      }

      if (attributeValue instanceof Factory) {
        if (persist) {
          entity[attribute] = await attributeValue.create(undefined, saveOptions)
        } else {
          entity[attribute] = await attributeValue.make()
        }
      }
    }

    return entity
  }

  /**
   * Return an instance of the factory for the given factory class.
   */
  factory<T>(factory: ClassConstructor<ExtractFactory<T>>): ExtractFactory<T> {
    return resolveFactory(this.seedingSource, factory, this.optionOverrides.factories)
  }
}

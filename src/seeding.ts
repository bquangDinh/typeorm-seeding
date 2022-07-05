import { SeederTypeOrClass, SeedingConfig, SeedingRunConfig } from './types'

import { ConfigManager } from './configuration/config-manager'
import { Seeder } from './seeder'
import { fetchDataSource } from './configuration/fetch-data-source'

export class Seeding {
  static configure(configOverrides: SeedingConfig) {
    ConfigManager.getInstance().merge(configOverrides)
  }

  static reconfigure(configuration: SeedingConfig) {
    ConfigManager.getInstance().replace(configuration)
  }

  static async run(
    entrySeeders: SeederTypeOrClass | SeederTypeOrClass[],
    configOverrides?: SeedingRunConfig,
  ): Promise<void> {
    if (configOverrides) this.configure(configOverrides)

    const dataSource = await fetchDataSource()

    const seeders = Array.isArray(entrySeeders) ? entrySeeders : [entrySeeders]

    for (const seeder of seeders) {
      if (seeder instanceof Seeder) {
        await seeder.run(dataSource)
      } else {
        await new seeder().run(dataSource)
      }
    }
  }
}
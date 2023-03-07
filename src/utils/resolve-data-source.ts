import { DataSource, DataSourceOptions } from 'typeorm'

export const resolveDataSource = async (dataSource: DataSource | DataSourceOptions): DataSource => {
  // create new instance if necessary
  const dataSourceToReturn = dataSource instanceof DataSource ? dataSource : new DataSource(dataSource)

  // Entity Metadatas won't be resolved if we don't call dataSource.initialize()
  // Thus causing error "No metadata for '' not found"
  await dataSourceToReturn.initialize()

  // return the data source
  return dataSourceToReturn
}

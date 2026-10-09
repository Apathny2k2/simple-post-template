/* The description of one HTTP endpoint, shared by api.ts and dash-api.ts. */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type Param = {
  name: string
  type: string
  required?: boolean
  note: string
}

export type EndpointSpec<Group extends string = string> = {
  method: HttpMethod
  path: string
  group: Group
  summary: string
  params?: Param[]
  body?: Param[]
  returns: string
  /** the part of the UI this endpoint feeds */
  usedBy?: string
}

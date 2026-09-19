/* ---------------------------------------------------------------
   One description of an HTTP endpoint, shared by every API surface
   in the app.

   The reference panels render straight from these, so documentation
   cannot drift from what the client actually calls - and a plugin
   author reading the panel is reading the same object the code uses.
   --------------------------------------------------------------- */

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
  /** shown as the endpoint badge next to the UI it backs */
  usedBy?: string
}

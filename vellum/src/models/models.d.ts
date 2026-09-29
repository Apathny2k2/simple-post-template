/* `?raw` imports a .vellum as text, so the bundled samples go through the
   same reader and checks as an opened file. */
declare module '*.vellum?raw' {
  const content: string
  export default content
}

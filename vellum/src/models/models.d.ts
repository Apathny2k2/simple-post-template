/* A `.vellum` is imported as its bytes and parsed by the codec, exactly
   as an opened file is - so the models that ship with the editor take the
   same path as the ones a user saves, rather than a JSON shortcut that
   would skip the reader's own validation. */
declare module '*.vellum?raw' {
  const content: string
  export default content
}

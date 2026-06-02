/** A captured `fetch` call: the resolved request URL and parsed JSON body. */
export type FetchRequest = { url: string; body: unknown };

/** Handler invoked by a `fetch` stub to produce a response payload for a request. */
export type FetchHandler = (req: FetchRequest) => unknown;

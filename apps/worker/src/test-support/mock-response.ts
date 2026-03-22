export function createMockResponse(
  body: string,
  init: {
    status: number;
    headers?: Record<string, string>;
  },
): Response {
  return {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    headers: {
      get(name: string) {
        const headerName = Object.keys(init.headers ?? {}).find(
          (key) => key.toLowerCase() === name.toLowerCase(),
        );
        return headerName ? init.headers?.[headerName] ?? null : null;
      },
    },
    async text() {
      return body;
    },
  } as Response;
}

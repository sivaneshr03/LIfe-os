/**
 * Safe API response parser and network helper
 * Prevents "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
 * when responses are empty, HTML, 502/503/504 proxy errors, or network disconnects.
 */

export async function safeParseJson<T = unknown>(
  res: Response
): Promise<{ data: T | null; error?: string }> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      return {
        data: null,
        error: res.ok ? undefined : `Server responded with status ${res.status}`,
      };
    }
    const json = JSON.parse(text) as T;
    return { data: json };
  } catch {
    return {
      data: null,
      error: `Invalid response format (${res.status}). Server may be starting or offline.`,
    };
  }
}

export async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(input, init);
    const { data, error } = await safeParseJson<T>(res);

    if (!res.ok) {
      const errObj = data as { error?: { message?: string } | string } | null;
      const serverMsg =
        typeof errObj?.error === 'string'
          ? errObj.error
          : errObj?.error?.message;

      return {
        ok: false,
        status: res.status,
        data,
        error: serverMsg || error || `Request failed with status ${res.status}`,
      };
    }

    return {
      ok: true,
      status: res.status,
      data,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Network error: Failed to connect to server';
    return {
      ok: false,
      status: 0,
      data: null,
      error: message.includes('Failed to fetch')
        ? 'Backend service is unreachable. Please verify the server is running.'
        : message,
    };
  }
}

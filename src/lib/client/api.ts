/** Small fetch helper: JSON in, JSON out, throws on error responses. */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
	const opts: RequestInit = { ...init };
	if (init?.json !== undefined) {
		opts.body = JSON.stringify(init.json);
		opts.headers = { 'content-type': 'application/json', ...(init.headers ?? {}) };
	}
	const res = await fetch(url, opts);
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText}`);
	return data as T;
}

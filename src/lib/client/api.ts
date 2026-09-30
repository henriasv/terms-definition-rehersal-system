/** JSON responses, including useful errors from the server and framework. */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
	const { json, ...opts } = init ?? {};
	const headers = new Headers(opts.headers);
	if (!headers.has('accept')) headers.set('accept', 'application/json');
	if (json !== undefined) {
		opts.body = JSON.stringify(json);
		headers.set('content-type', 'application/json');
	}
	opts.headers = headers;
	const res = await fetch(url, opts);
	const body = await res.text();
	let data: unknown;
	try { data = JSON.parse(body); } catch { /* Framework/proxy errors can be plain text. */ }
	if (!res.ok) {
		const error = data && typeof data === 'object'
			? (data as { error?: unknown; message?: unknown }).error ?? (data as { message?: unknown }).message
			: undefined;
		const message = typeof error === 'string' ? error
			: !res.headers.get('content-type')?.includes('text/html') && body.trim() ? body.trim().slice(0, 500)
			: `${res.status} ${res.statusText}`;
		if (res.status === 403 && message.startsWith('Cross-site ')) {
			throw new Error('The app rejected this request because its server address does not match the browser address. Restart the app with pnpm start and reopen its local address.');
		}
		throw new Error(message);
	}
	if (data === undefined) throw new Error('The server returned an unreadable response. Reload the app and try again.');
	return data as T;
}

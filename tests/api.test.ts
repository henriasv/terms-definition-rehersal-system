import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/lib/client/api.ts';

afterEach(() => vi.unstubAllGlobals());

describe('API responses', () => {
	it.each([
		new Response('Cross-site POST form submissions are forbidden', { status: 403 }),
		Response.json({ message: 'Cross-site POST form submissions are forbidden' }, { status: 403 })
	])('explains origin rejection without exposing a JSON parsing error', async response => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
		await expect(api('/api/papers')).rejects.toThrow('Restart the app with pnpm start');
	});

	it('keeps multipart uploads intact while requesting JSON responses', async () => {
		const fetch = vi.fn().mockResolvedValue(Response.json({ id: 'paper-id' }, { status: 202 }));
		vi.stubGlobal('fetch', fetch);
		const body = new FormData();
		body.set('pdf', new Blob(['%PDF-']), 'paper.pdf');
		expect(await api('/api/papers', { method: 'POST', body })).toEqual({ id: 'paper-id' });
		const options = fetch.mock.calls[0][1] as RequestInit;
		expect(options.body).toBe(body);
		const headers = new Headers(options.headers);
		expect(headers.get('accept')).toBe('application/json');
		// Fetch supplies the boundary; setting Content-Type here breaks PDF parsing.
		expect(headers.has('content-type')).toBe(false);
	});

	it.each([
		[Response.json({ error: 'Choose a PDF.' }, { status: 400 }), 'Choose a PDF.'],
		[new Response('Upload too large', { status: 413 }), 'Upload too large'],
		[new Response('<html>proxy failure</html>', { status: 502, statusText: 'Bad Gateway', headers: { 'content-type': 'text/html' } }), '502 Bad Gateway']
	])('preserves useful errors and handles HTML failures', async (response, message) => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
		await expect(api('/api/papers')).rejects.toThrow(message);
	});

	it('rejects an unreadable success response instead of reporting false success', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not JSON')));
		await expect(api('/api/papers')).rejects.toThrow('unreadable response');
	});
});

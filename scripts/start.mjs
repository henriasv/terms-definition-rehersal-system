// adapter-node assumes HTTPS unless ORIGIN is set. The desktop app uses HTTP.
process.env.HOST ??= '127.0.0.1';
process.env.PORT ??= '5173';
process.env.BODY_SIZE_LIMIT ??= '45M';
const host = process.env.HOST.includes(':') ? `[${process.env.HOST}]` : process.env.HOST;
process.env.ORIGIN ??= `http://${host}:${process.env.PORT}`;

await import('../build/index.js');

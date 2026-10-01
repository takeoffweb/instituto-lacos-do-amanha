import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

// Servidor exclusivamente local, também importado pelos testes.
export function createPreviewServer(directory = root) {
    const base = path.resolve(directory);
    return http.createServer(async (request, response) => {
        try {
            const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            const file = path.resolve(base, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
            const relative = path.relative(base, file);
            if (relative.startsWith('..') || path.isAbsolute(relative)) {
                response.writeHead(403).end();
                return;
            }
            if (!(await stat(file)).isFile()) throw new Error('Não é arquivo');
            const content = await readFile(file);
            response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': content.length, 'Cache-Control': 'no-store' });
            response.end(content);
        } catch {
            response.writeHead(404).end('Arquivo não encontrado');
        }
    });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await stat(path.join(root, 'index.html'));
    const server = createPreviewServer();
    server.listen(4173, '127.0.0.1', () => console.log('Produção local: http://127.0.0.1:4173'));
}

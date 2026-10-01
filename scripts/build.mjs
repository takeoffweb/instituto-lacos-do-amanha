import { readFile, writeFile, mkdir, rm, stat, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'html-minifier-terser';
import { transform } from 'esbuild';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.resolve(root, 'dist');
const reports = path.resolve(root, 'relatorios');
const htmlFiles = ['index.html', 'projetos.html', 'cadastro.html'];
const codeFiles = ['css/style.css', 'js/script.js', 'js/armazenamento.js', 'js/acessibilidade.js'];
const widths = [480, 960, 1536];
// Largura da imagem, descontando padding do container, gap da grade e padding do picture.
const sizes = '(min-width: 1440px) 703.34px, (min-width: 1280px) 544px, (min-width: 1120px) 508px, (min-width: 1024px) calc(50vw - 52px), (min-width: 480px) calc(100vw - 64px), calc(100vw - 48px)';
const srcset = (format) => widths.map((width) => `imagens/ong-${width}.${format} ${width}w`).join(', ');

function responsivePicture(html) {
    const picture = /<picture class="hero-imagem">[\s\S]*?<\/picture>/g;
    const matches = [...html.matchAll(picture)];
    if (matches.length !== 1) throw new Error('Esperado exatamente um picture hero-imagem no index.html.');
    return html.replace(picture, (original) => {
        const img = original.match(/<img\b[^>]*>/)?.[0];
        if (!img) throw new Error('Imagem principal ausente.');
        const responsiveImg = img.replace('src="imagens/ong.jpg"', 'src="imagens/ong-1536.jpg"')
            .replace('<img ', `<img srcset="${srcset('jpg')}" sizes="${sizes}" `);
        return `<picture class="hero-imagem">\n    <source type="image/webp" srcset="${srcset('webp')}" sizes="${sizes}">\n    ${responsiveImg}\n</picture>`;
    });
}

const reduction = (before, after) => Number(((before - after) / before * 100).toFixed(2));
const size = async (file) => (await stat(file)).size;
const rows = [];
const images = [];

// A limpeza só pode atingir dist/ neste projeto; não segue links de diretório.
if (path.dirname(dist) !== path.resolve(root) || path.basename(dist) !== 'dist') throw new Error('Destino inválido.');
const existing = await lstat(dist).catch((error) => { if (error.code !== 'ENOENT') throw error; });
if (existing?.isSymbolicLink()) throw new Error('dist não pode ser um link simbólico.');
await rm(dist, { recursive: true, force: true });
for (const folder of ['css', 'js', 'imagens']) await mkdir(path.join(dist, folder), { recursive: true });
await mkdir(reports, { recursive: true });

// Os dois formatos são gerados do JPG original, evitando recomprimir o WebP já comprimido.
const originalImage = path.join(root, 'imagens/ong.jpg');
const metadata = await sharp(originalImage).metadata();
if (metadata.width !== 1536 || metadata.height !== 1024) throw new Error('Atualize as variantes e dimensões para a nova imagem.');
for (const width of widths) {
    for (const format of ['jpg', 'webp']) {
        const file = `imagens/ong-${width}.${format}`;
        const pipeline = sharp(originalImage).resize({ width, withoutEnlargement: true });
        if (format === 'jpg') pipeline.jpeg({ quality: 80, mozjpeg: true });
        else pipeline.webp({ quality: 80, effort: 6 });
        const info = await pipeline.toFile(path.join(dist, file));
        const originalBytes = await size(path.join(root, `imagens/ong.${format}`));
        images.push({ file, width: info.width, height: info.height, bytes: info.size, originalBytes, reductionPercent: reduction(originalBytes, info.size) });
    }
}

for (const file of htmlFiles) {
    const original = await readFile(path.join(root, file), 'utf8');
    const prepared = file === 'index.html' ? responsivePicture(original) : original;
    const output = await minify(prepared, {
        collapseWhitespace: true,
        conservativeCollapse: true,
        removeComments: true,
        removeAttributeQuotes: false,
        removeOptionalTags: false,
        removeEmptyAttributes: false,
        minifyCSS: false,
        minifyJS: false
    });
    await writeFile(path.join(dist, file), output);
    rows.push({ file, category: 'HTML', originalBytes: await size(path.join(root, file)), preparedBytes: Buffer.byteLength(prepared), bytes: await size(path.join(dist, file)) });
}
for (const file of codeFiles) {
    const original = await readFile(path.join(root, file), 'utf8');
    // Sem bundle, purge, mangleProps ou mudança para módulos: mantém a API global.
    const output = await transform(original, { loader: file.endsWith('.css') ? 'css' : 'js', minify: true, charset: 'utf8', legalComments: 'none', target: 'es2022' });
    await writeFile(path.join(dist, file), output.code);
    rows.push({ file, category: file.endsWith('.css') ? 'CSS' : 'JavaScript', originalBytes: await size(path.join(root, file)), preparedBytes: Buffer.byteLength(original), bytes: await size(path.join(dist, file)) });
}
for (const row of rows) row.reductionPercent = reduction(row.originalBytes, row.bytes);
const categories = ['HTML', 'CSS', 'JavaScript'].map((category) => {
    const group = rows.filter((row) => row.category === category);
    const originalBytes = group.reduce((sum, row) => sum + row.originalBytes, 0);
    const bytes = group.reduce((sum, row) => sum + row.bytes, 0);
    return { category, originalBytes, bytes, reductionPercent: reduction(originalBytes, bytes) };
});
const originalImages = await size(path.join(root, 'imagens/ong.jpg')) + await size(path.join(root, 'imagens/ong.webp'));
const outputImages = images.reduce((sum, row) => sum + row.bytes, 0);
categories.push({ category: 'Imagens (pasta completa)', originalBytes: originalImages, bytes: outputImages, reductionPercent: reduction(originalImages, outputImages) });
const originalTotal = categories.reduce((sum, row) => sum + row.originalBytes, 0);
const outputTotal = categories.reduce((sum, row) => sum + row.bytes, 0);
const report = { unit: 'bytes em disco, sem compressão HTTP', sizes, files: rows, images, categories, total: { originalBytes: originalTotal, bytes: outputTotal, reductionPercent: reduction(originalTotal, outputTotal) } };
await writeFile(path.join(reports, 'build.json'), JSON.stringify(report, null, 2) + '\n');
const table = (data) => ['| Arquivo/categoria | Original (bytes) | Produção (bytes) | Redução |', '|---|---:|---:|---:|', ...data.map((r) => `| ${r.file ?? r.category} | ${r.originalBytes} | ${r.bytes} | ${r.reductionPercent}% |`)].join('\n');
await writeFile(path.join(reports, 'build.md'), `# Medição da build\n\nValores reais em bytes, sem compressão HTTP. O index de produção inclui srcset/sizes adicionais; a comparação usa o fonte original.\n\n${table(rows)}\n\n${table([...categories, { category: 'TOTAL', ...report.total }])}\n\n## Variantes\n\nCada variante é comparada ao original do mesmo formato. O navegador normalmente baixa uma variante, não a pasta inteira.\n\n${table(images)}\n\n## sizes\n\n\`${sizes}\`\n`);
console.table(categories);
console.log('Total:', report.total);
console.log('Build em dist/. Relatórios em relatorios/build.json e relatorios/build.md.');

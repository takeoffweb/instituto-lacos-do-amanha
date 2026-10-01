import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createPreviewServer } from './preview.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await access(path.join(root, 'dist/index.html'));
await mkdir(path.join(root, 'relatorios'), { recursive: true });
const server = createPreviewServer(root);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
// /dist/ também exercita publicação em subpasta e caminhos relativos.
const base = `${origin}/dist/`;
let browser;
const passed = [];
const measurements = [];
const errors = [];
const key = 'lacos-do-amanha:alto-contraste';
async function check(name, action) {
    await action();
    passed.push(name);
    console.log('OK:', name);
}
async function waitFocus(page, id) {
    await page.waitForFunction((expected) => document.activeElement.id === expected, id);
}
try {
    const candidates = [process.env.BROWSER_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
    let executablePath;
    for (const candidate of candidates) {
        try { await access(candidate); executablePath = candidate; break; } catch { /* tenta o próximo */ }
    }
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    for (const width of [390, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
        page.on('requestfailed', (request) => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) errors.push(request.url()); });
        for (const file of ['index.html', 'projetos.html', 'cadastro.html']) {
            await page.goto(base + file);
            await check(`${width}px: ${file}, atributos e recursos`, async () => {
                const original = await readFile(path.join(root, file), 'utf8');
                const generated = await readFile(path.join(root, 'dist', file), 'utf8');
                const equivalent = await page.evaluate(({ original, generated }) => {
                    function attributes(html) {
                        const doc = new DOMParser().parseFromString(html, 'text/html');
                        return [...doc.querySelectorAll('*')].map((element) => ({
                            tag: element.tagName,
                            attrs: [...element.attributes].filter((a) => !(['IMG', 'SOURCE'].includes(element.tagName) && ['src', 'srcset', 'sizes'].includes(a.name))).map((a) => {
                                // Serializações equivalentes de atributos booleanos e viewport.
                                if (['defer', 'required', 'autofocus'].includes(a.name)) return [a.name, true];
                                if (element.tagName === 'META' && element.getAttribute('name') === 'viewport' && a.name === 'content') {
                                    return [a.name, a.value.replace(/\s/g, '').replace('initial-scale=1.0', 'initial-scale=1')];
                                }
                                return [a.name, a.value];
                            }).sort()
                        }));
                    }
                    return { original: attributes(original), generated: attributes(generated) };
                }, { original, generated });
                assert.deepEqual(equivalent.generated, equivalent.original, 'A minificação mudou atributos/estrutura além do picture');
                assert.deepEqual(await page.locator('script[src]').evaluateAll((scripts) => scripts.map((s) => [s.getAttribute('src'), s.defer])), [['js/script.js', true], ['js/armazenamento.js', true], ['js/acessibilidade.js', true]]);
                const targets = await page.locator('a[href], link[href], script[src], img[src], source[srcset], img[srcset]').evaluateAll((elements) => elements.flatMap((e) => {
                    const values = [e.getAttribute('href'), e.getAttribute('src')].filter(Boolean);
                    if (e.hasAttribute('srcset')) values.push(...e.getAttribute('srcset').split(',').map((v) => v.trim().split(/\s+/)[0]));
                    return values.map((value) => new URL(value, document.baseURI).href);
                }));
                for (const target of new Set(targets)) {
                    if (!target.startsWith(origin)) continue;
                    const response = await context.request.get(target.split('#')[0]);
                    assert.equal(response.status(), 200, target);
                    const hash = new URL(target).hash;
                    if (hash) assert((await response.text()).includes(`id="${decodeURIComponent(hash.slice(1))}"`), target);
                }
            });
        }
        await page.goto(base + 'index.html');
        await check(`${width}px: pular conteúdo e foco visível`, async () => {
            await page.keyboard.press('Tab');
            assert.equal(await page.locator(':focus').getAttribute('class'), 'pular-conteudo');
            assert.equal(await page.locator(':focus').evaluate((e) => getComputedStyle(e).outlineStyle), 'solid');
            await page.keyboard.press('Enter');
            await waitFocus(page, 'conteudo');
        });
        await check(`${width}px: navegação e menus por teclado`, async () => {
            if (width < 1024) {
                await page.locator('.botao-menu').focus();
                await page.keyboard.press('Enter');
                assert.equal(await page.locator('.botao-menu').getAttribute('aria-expanded'), 'true');
            }
            await page.locator('.botao-submenu').focus();
            await page.keyboard.press('Space');
            assert.equal(await page.locator('.botao-submenu').getAttribute('aria-expanded'), 'true');
            await page.keyboard.press('Tab');
            assert.equal(await page.locator(':focus').getAttribute('href'), 'projetos.html#roda-de-leitura');
            await page.keyboard.press('Escape');
            assert(await page.locator('.botao-submenu').evaluate((e) => e === document.activeElement));
            assert.equal(await page.locator('.botao-submenu').getAttribute('aria-expanded'), 'false');
            if (width < 1024) {
                await page.keyboard.press('Escape');
                assert.equal(await page.locator('.botao-menu').getAttribute('aria-expanded'), 'false');
                await page.locator('.botao-menu').click();
            }
            await page.locator('.dropdown-controles a').click();
            await page.waitForURL(base + 'projetos.html');
            for (const id of ['roda-de-leitura', 'mesa-compartilhada', 'comunidade-em-rede']) {
                if (width < 1024 && await page.locator('.botao-menu').getAttribute('aria-expanded') === 'false') await page.locator('.botao-menu').click();
                await page.locator('.botao-submenu').focus();
                if (await page.locator('.botao-submenu').getAttribute('aria-expanded') === 'false') await page.keyboard.press('Space');
                await page.locator(`.submenu a[href$="#${id}"]`).focus();
                await page.keyboard.press('Enter');
                await waitFocus(page, id);
            }
            if (width < 1024) await page.locator('.botao-menu').click();
            await page.locator('.menu > li > a[href="cadastro.html"]').click();
            await page.waitForURL(base + 'cadastro.html');
            await page.locator('.identidade').click();
            await page.waitForURL(base + 'index.html');
        });
        await check(`${width}px: contraste, recarga e persistência entre páginas`, async () => {
            await page.locator('#alternar-contraste').focus();
            await page.keyboard.press('Space');
            assert.equal(await page.locator('#alternar-contraste').getAttribute('aria-pressed'), 'true');
            assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), 'true');
            assert.equal(await page.locator('body').evaluate((e) => getComputedStyle(e).backgroundColor), 'rgb(0, 0, 0)');
            await page.reload();
            assert(await page.locator('html').evaluate((e) => e.classList.contains('alto-contraste')));
            await page.goto(base + 'cadastro.html');
            assert.equal(await page.locator('#alternar-contraste').getAttribute('aria-pressed'), 'true');
        });
        await check(`${width}px: modal, Tab, Shift+Tab, Esc e retorno de foco`, async () => {
            const trigger = page.locator('#abrir-modal');
            await trigger.focus();
            await page.keyboard.press('Enter');
            await waitFocus(page, 'titulo-modal');
            assert(await page.locator('dialog').evaluate((e) => e.matches(':modal')));
            await page.keyboard.press('Tab');
            assert(await page.locator('dialog button').evaluate((e) => e === document.activeElement));
            await page.keyboard.press('Tab');
            assert(await page.locator('dialog button').evaluate((e) => e === document.activeElement));
            await page.keyboard.press('Shift+Tab');
            assert(await page.locator('dialog button').evaluate((e) => e === document.activeElement));
            await page.keyboard.press('Escape');
            await waitFocus(page, 'abrir-modal');
            assert.equal(await page.locator('dialog').evaluate((e) => e.open), false);
            await trigger.click();
            await page.locator('dialog button').click();
            await waitFocus(page, 'abrir-modal');
        });
        await check(`${width}px: formulário, erros, correção e sucesso sem envio`, async () => {
            await page.locator('#formulario-cadastro button[type="submit"]').click();
            assert.equal(await page.locator('input[aria-invalid="true"]').count(), 9);
            await waitFocus(page, 'nome');
            assert.match(await page.locator('#alerta-formulario').innerText(), /9 campos/);
            const values = { nome: 'Pessoa de Teste', nascimento: '1990-01-01', cpf: '123.456.789-00', email: 'teste@example.com', telefone: '(11) 99999-9999', cep: '12345-678', endereco: 'Rua Exemplo, 1', cidade: 'Cidade Exemplo', estado: 'SP' };
            for (const [id, value] of Object.entries(values)) {
                assert.equal(await page.locator(`label[for="${id}"]`).count(), 1);
                assert((await page.locator('#' + id).getAttribute('aria-describedby')).includes('feedback-' + id));
                await page.locator('#' + id).fill(value);
            }
            await page.locator('#email').fill('email-invalido');
            await page.locator('#formulario-cadastro button[type="submit"]').click();
            await waitFocus(page, 'email');
            assert.equal(await page.locator('#email').getAttribute('aria-invalid'), 'true');
            await page.locator('#email').fill(values.email);
            await page.locator('#formulario-cadastro button[type="submit"]').click();
            await page.waitForFunction(() => document.querySelector('#toast-mensagem').textContent.includes('sucesso'));
            assert.equal(page.url(), base + 'cadastro.html');
            assert.equal(await page.locator('#toast-mensagem').getAttribute('role'), 'status');
            assert.equal(await page.locator('input[aria-invalid="true"]').count(), 0);
            assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), [key]);
            await page.locator('#fechar-toast').click();
            assert(await page.locator('#formulario-cadastro button[type="submit"]').evaluate((e) => e === document.activeElement));
            assert.equal(await page.locator('#toast').isVisible(), false);
            await page.locator('#alternar-contraste').click();
            await page.reload();
            assert.equal(await page.locator('#alternar-contraste').getAttribute('aria-pressed'), 'false');
        });
        await context.close();
    }
    for (const [width, dpr] of [[390, 1], [390, 2], [768, 1], [1280, 1], [1440, 2]]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: dpr });
        const page = await context.newPage();
        await page.goto(base + 'index.html');
        await page.locator('.hero-imagem img').evaluate((img) => img.decode());
        const image = await page.locator('.hero-imagem img').evaluate((img) => ({ selected: new URL(img.currentSrc).pathname.replace('/dist/', ''), renderedWidth: img.getBoundingClientRect().width, complete: img.complete, alt: img.alt, loading: img.getAttribute('loading') }));
        assert(image.complete && image.alt && image.loading !== 'lazy');
        const bytes = (await stat(path.join(root, 'dist', image.selected))).size;
        measurements.push({ viewport: width, dpr, ...image, bytes });
        if (width === 390 && dpr === 1) assert.equal(image.selected, 'imagens/ong-480.webp');
        if (width === 1280) await page.screenshot({ path: path.join(root, 'relatorios/producao-desktop.png'), fullPage: true });
        if (width === 390 && dpr === 1) await page.screenshot({ path: path.join(root, 'relatorios/producao-mobile.png'), fullPage: true });
        await context.close();
    }
    passed.push('srcset: seleção real em cinco combinações de viewport/DPR');
    await check('JPG de fallback carrega e tem proporção correta', async () => {
        const page = await browser.newPage();
        await page.goto(base + 'index.html');
        await page.locator('picture source').evaluate((source) => source.remove());
        await page.locator('picture img').evaluate((img) => img.decode());
        assert((await page.locator('picture img').evaluate((img) => img.currentSrc)).endsWith('.jpg'));
        assert.equal(await page.locator('picture img').evaluate((img) => Number(img.getAttribute('width')) / Number(img.getAttribute('height'))), 1.5);
        await page.close();
    });
    await check('Contraste funciona com localStorage bloqueado', async () => {
        const context = await browser.newContext();
        await context.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Bloqueado', 'SecurityError'); } }); });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(base + 'index.html');
        await page.locator('#alternar-contraste').click();
        assert.equal(await page.locator('#alternar-contraste').getAttribute('aria-pressed'), 'true');
        await context.close();
    });
    await check('Sem JavaScript: navegação e validação HTML preservadas', async () => {
        const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
        const page = await context.newPage();
        await page.goto(base + 'index.html');
        assert(await page.locator('nav').isVisible());
        assert.equal(await page.locator('#alternar-contraste').isVisible(), false);
        await page.locator('.menu > li > a[href="cadastro.html"]').click();
        await page.waitForURL(base + 'cadastro.html');
        assert.equal(await page.locator('input[required]').count(), 9);
        await context.close();
    });
    assert.deepEqual(errors, [], 'Erros de execução ou recursos');
    await writeFile(path.join(root, 'relatorios/testes.json'), JSON.stringify({ browser: browser.version(), passed, measurements, errors }, null, 2) + '\n');
    console.table(measurements);
    console.log(`${passed.length} verificações concluídas. Relatório: relatorios/testes.json`);
} finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
}

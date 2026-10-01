# Instituto Laços do Amanhã

Site acadêmico estático com três páginas. Os fontes HTML, CSS, JavaScript e as imagens originais permanecem legíveis e independentes da build. Não há SPA, framework, backend ou deploy configurado.

## Preparação e comandos

Requer Node.js 22 ou superior e npm. Instale as versões registradas no lockfile:

```sh
npm ci
npm run build
npm test
npm run preview
```

O preview fica em `http://127.0.0.1:4173`. Encerre com Ctrl+C. Ele serve somente `dist/`, sem redirecionar páginas inexistentes para o início.

Os testes usam Playwright com Chrome/Edge instalado nos caminhos padrão do Windows. Em outro ambiente, defina `BROWSER_PATH` ou instale o Chromium do Playwright com `npx playwright install chromium`. O navegador é usado apenas nos testes, não na build nem no site publicado.

## Build

`scripts/build.mjs` recria apenas `dist/` dentro deste projeto. A saída contém:

```text
dist/
  index.html
  projetos.html
  cadastro.html
  css/style.css
  js/script.js
  js/armazenamento.js
  js/acessibilidade.js
  imagens/ong-{480,960,1536}.{jpg,webp}
```

- HTML: `html-minifier-terser`, removendo comentários e reduzindo espaços de forma conservadora. Mantém tags, atributos e espaços necessários ao texto.
- CSS e JS: `esbuild`, apenas minificação, sem bundle, remoção de classes dinâmicas ou renomeação de propriedades. Scripts clássicos separados, com `defer`, na ordem original.
- Imagens: `sharp`, a partir de `imagens/ong.jpg`; JPEG com qualidade 80 e mozjpeg, WebP com qualidade 80 e esforço 6. Variantes de 480×320, 960×640 e 1536×1024, sem recorte ou ampliação.
- Os fontes não são sobrescritos. A build transforma o `<picture>` apenas no HTML de produção; o HTML-fonte continua funcionando com os originais. Nenhuma imagem gerada precisa existir para abrir os fontes.

## Imagem responsiva

O `<source type="image/webp">` gerado oferece `ong-480.webp 480w`, `ong-960.webp 960w` e `ong-1536.webp 1536w`. O `<img>` oferece os mesmos tamanhos em JPG, com `src="imagens/ong-1536.jpg"` como fallback.

Ambos usam:

```text
(min-width: 1440px) 703.34px,
(min-width: 1280px) 544px,
(min-width: 1120px) 508px,
(min-width: 1024px) calc(50vw - 52px),
(min-width: 480px) calc(100vw - 64px),
calc(100vw - 48px)
```

Esses valores correspondem ao container, às colunas, aos gaps e ao padding atuais. Ao mudar esse layout, revise `sizes` em `scripts/build.mjs`. A build preserva `alt`, `width="1536"`, `height="1024"` e não adiciona lazy loading à imagem principal.

## Medição

Cada build gera `relatorios/build.json` e `relatorios/build.md`, com bytes reais por arquivo, categoria e variante. Os totais comparam os nove arquivos originais do site com todos os arquivos publicados em `dist/`; não incluem dependências, scripts de build, relatórios ou cache npm.

A comparação de HTML usa o fonte original, portanto já considera o custo adicional de `srcset` e `sizes`. O JSON também registra o HTML preparado antes da minificação (`preparedBytes`). Percentuais são calculados por `(original - produção) / original × 100`.

O total da pasta de imagens inclui seis arquivos. Em uma navegação normal, o navegador escolhe uma variante, conforme largura, DPR e suas próprias políticas. `relatorios/testes.json` registra as escolhas reais observadas em contextos novos do navegador, com os tamanhos dos arquivos selecionados. Esses valores não incluem cabeçalhos HTTP, compressão HTTP dos textos ou efeitos de cache.

## Testes de produção

`npm test` executa a build já existente, por HTTP local e em subpasta, verificando:

- estrutura e atributos HTML em relação aos fontes, incluindo labels, ARIA, patterns e tabindex;
- caminhos de links, âncoras, scripts, CSS e todas as variantes de imagem;
- menu móvel e desktop, teclado, Esc, foco visível e link de pular conteúdo;
- foco dos três destinos internos;
- modal nativo, Tab, Shift+Tab, Esc, botão de fechar e retorno de foco;
- formulário vazio, e-mail inválido, correção, mensagens, sucesso e fechamento do toast;
- contraste, persistência entre páginas/recargas e armazenamento bloqueado;
- funcionamento básico sem JavaScript;
- seleção de WebP responsivo e fallback JPG;
- erros de execução e respostas HTTP de erro nas páginas exercitadas.

O teste gera capturas da página inicial em desktop e mobile e um relatório JSON. Leitor de tela, outros navegadores e avaliação humana detalhada da qualidade das imagens continuam sendo verificações manuais.

## Publicação futura

Não foi feito deploy. A pasta publicável é exclusivamente `dist/`. Antes de publicar, execute build e testes. Preserve os caminhos relativos e as três páginas; não configure fallback de SPA ou captura automática de formulários.

A preferência `lacos-do-amanha:alto-contraste` é local à origem. Ela não migra automaticamente do localhost para o domínio publicado. Com JavaScript ativo o formulário não envia nem salva dados; sem JavaScript permanece o comportamento GET original, indicado na própria página.

## Ocorrências nesta preparação

- O ambiente inicial tinha npm em modo offline; as dependências foram instaladas pela rede com versões fixadas no lockfile.
- A validação TLS exigiu usar os certificados confiáveis do Windows (`NODE_USE_SYSTEM_CA=1`), sem desativar a verificação de certificados.
- O sandbox bloqueou o processo nativo do esbuild com `EPERM`; a build e o navegador de teste foram executados com a autorização de ambiente necessária.
- A comparação de HTML foi ajustada para aceitar serializações semanticamente equivalentes de booleanos e viewport feitas pelo minificador.
- A automação dos links internos usa teclado para não misturar a abertura por hover com o acionamento do botão do submenu. Nenhuma lógica da aplicação foi alterada para adaptar os testes.

(() => {
    const raiz = document.documentElement;
    const botao = document.querySelector('#alternar-contraste');
    function aplicarContraste(ativo) {
        raiz.classList.toggle('alto-contraste', ativo);
        botao.setAttribute('aria-pressed', String(ativo));
    }
    aplicarContraste(window.Armazenamento.lerContraste());
    botao.hidden = false;
    botao.addEventListener('click', () => {
        const ativo = !raiz.classList.contains('alto-contraste');
        aplicarContraste(ativo);
        window.Armazenamento.salvarContraste(ativo);
    });

    const modal = document.querySelector('#modal-participacao');
    const abrir = document.querySelector('#abrir-modal');
    if (!modal || !abrir) return;
    let origem;
    abrir.hidden = false;
    abrir.addEventListener('click', () => {
        origem = document.activeElement;
        modal.showModal();
        modal.querySelector('#titulo-modal').focus();
    });
    // showModal mantém o fundo inerte; Escape dispara o fechamento nativo.
    modal.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') evento.stopPropagation();
        if (evento.key !== 'Tab') return;
        const controles = [...modal.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
            .filter((elemento) => elemento.tabIndex >= 0 && !elemento.disabled && elemento.getClientRects().length);
        const primeiro = controles[0];
        const ultimo = controles.at(-1);
        if (!primeiro) return;
        if (evento.shiftKey && (document.activeElement === primeiro || !controles.includes(document.activeElement))) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primeiro.focus();
        }
    });
    modal.addEventListener('close', () => {
        if (origem?.isConnected) origem.focus();
    });
})();

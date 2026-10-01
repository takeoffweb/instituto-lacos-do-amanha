// A navegação continua disponível quando o JavaScript está desativado.
document.documentElement.classList.add('js');
const botaoMenu = document.querySelector('.botao-menu');
const navegacao = document.querySelector('#navegacao');
const dropdown = document.querySelector('.dropdown');
const botaoSubmenu = document.querySelector('.botao-submenu');
const desktop = window.matchMedia('(min-width: 1024px)');
botaoMenu.hidden = false;
botaoSubmenu.hidden = false;

function alternarSubmenu(aberto) {
    if (!aberto && dropdown.querySelector('.submenu').contains(document.activeElement)) botaoSubmenu.focus();
    dropdown.classList.toggle('aberto', aberto);
    botaoSubmenu.setAttribute('aria-expanded', String(aberto));
    botaoSubmenu.setAttribute('aria-label', aberto ? 'Ocultar iniciativas' : 'Mostrar iniciativas');
}

function alternarMenu(aberto) {
    if (!aberto && !desktop.matches && navegacao.contains(document.activeElement)) botaoMenu.focus();
    navegacao.classList.toggle('aberto', aberto);
    botaoMenu.setAttribute('aria-expanded', String(aberto));
    botaoMenu.setAttribute('aria-label', aberto ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
    if (!aberto) alternarSubmenu(false);
}

botaoMenu.addEventListener('click', () => alternarMenu(botaoMenu.getAttribute('aria-expanded') !== 'true'));
botaoSubmenu.addEventListener('click', () => alternarSubmenu(botaoSubmenu.getAttribute('aria-expanded') !== 'true'));
dropdown.addEventListener('mouseenter', () => { if (desktop.matches) alternarSubmenu(true); });
dropdown.addEventListener('mouseleave', () => {
    if (!dropdown.contains(document.activeElement)) alternarSubmenu(false);
});
dropdown.addEventListener('focusin', (evento) => {
    if (desktop.matches && evento.target.matches('a')) alternarSubmenu(true);
});
dropdown.addEventListener('focusout', (evento) => {
    if (!dropdown.contains(evento.relatedTarget)) alternarSubmenu(false);
});
navegacao.addEventListener('click', (evento) => {
    const link = evento.target.closest('a');
    if (!link) return;
    alternarMenu(false);
    const destino = new URL(link.href);
    if (destino.pathname === location.pathname && destino.hash) {
        document.getElementById(decodeURIComponent(destino.hash.slice(1)))?.focus();
    }
});
document.addEventListener('click', (evento) => {
    if (!evento.target.closest('.cabecalho')) alternarMenu(false);
});
document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape') return;
    if (dropdown.classList.contains('aberto')) {
        alternarSubmenu(false);
        botaoSubmenu.focus();
    } else if (navegacao.classList.contains('aberto') && !desktop.matches) {
        alternarMenu(false);
        botaoMenu.focus();
    }
});
desktop.addEventListener('change', () => {
    const foco = document.activeElement;
    alternarMenu(false);
    if (!desktop.matches && navegacao.contains(foco)) botaoMenu.focus();
    if (desktop.matches && foco === botaoMenu) navegacao.querySelector('a').focus();
});

const formulario = document.querySelector('#formulario-cadastro');
if (formulario) {
    const campos = formulario.querySelectorAll('input');
    const alerta = document.querySelector('#alerta-formulario');
    const toast = document.querySelector('#toast');
    const mensagemToast = document.querySelector('#toast-mensagem');
    const fecharToast = document.querySelector('#fechar-toast');
    let tentouEnviar = false;

    function esconderToast() {
        toast.hidden = true;
        mensagemToast.textContent = '';
    }

    function atualizarCampo(campo) {
        campo.classList.add('campo-tocado');
        campo.setAttribute('aria-invalid', String(!campo.validity.valid));
        const mensagem = document.getElementById('feedback-' + campo.id);
        mensagem.textContent = campo.validity.valid ? '✓ Campo válido.' : 'Corrija este campo: ' + campo.validationMessage;
    }

    function atualizarAlerta() {
        const invalidos = [...campos].filter((campo) => !campo.validity.valid).length;
        alerta.textContent = tentouEnviar && invalidos ? `Existem ${invalidos} campos que precisam ser corrigidos. Consulte as mensagens junto aos campos.` : '';
    }

    campos.forEach((campo) => {
        const mensagem = document.createElement('span');
        mensagem.id = 'feedback-' + campo.id;
        mensagem.className = 'mensagem-campo';
        campo.parentElement.append(mensagem);
        const ajuda = campo.getAttribute('aria-describedby');
        campo.setAttribute('aria-describedby', [ajuda, mensagem.id].filter(Boolean).join(' '));
        campo.addEventListener('blur', () => atualizarCampo(campo));
        campo.addEventListener('input', () => {
            esconderToast();
            if (campo.classList.contains('campo-tocado')) atualizarCampo(campo);
            atualizarAlerta();
        });
    });

    // invalid usa captura: a validação nativa ocorre antes do evento submit.
    formulario.addEventListener('invalid', () => {
        tentouEnviar = true;
        esconderToast();
        campos.forEach(atualizarCampo);
        atualizarAlerta();
    }, true);

    formulario.addEventListener('submit', (evento) => {
        evento.preventDefault();
        campos.forEach(atualizarCampo);
        alerta.textContent = '';
        tentouEnviar = false;
        toast.hidden = false;
        // A mensagem entra depois que a região de status fica visível.
        requestAnimationFrame(() => {
            mensagemToast.textContent = 'Formulário validado com sucesso. Esta é uma demonstração acadêmica; nenhum dado foi enviado ou salvo.';
        });
    });
    fecharToast.addEventListener('click', () => {
        esconderToast();
        formulario.querySelector('[type="submit"]').focus();
    });
}

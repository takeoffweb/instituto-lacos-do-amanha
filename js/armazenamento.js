// Preferências ficam separadas dos dados do formulário, que não são salvos.
window.Armazenamento = (() => {
    const chave = 'lacos-do-amanha:alto-contraste';
    return {
        lerContraste() {
            try { return localStorage.getItem(chave) === 'true'; }
            catch { return false; }
        },
        salvarContraste(ativo) {
            try { localStorage.setItem(chave, String(ativo)); }
            catch { /* O controle continua funcionando sem armazenamento disponível. */ }
        }
    };
})();

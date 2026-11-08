// Aplica o tema salvo antes da renderização (evita "piscar" de tema)
try {
  const t = localStorage.getItem('wi-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch { /* armazenamento indisponível */ }

// Marca quando o site está aberto dentro do app Android
if (/WalissonImoveisApp\//.test(navigator.userAgent)) document.documentElement.classList.add('in-app');

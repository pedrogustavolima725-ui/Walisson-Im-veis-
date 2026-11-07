// Aplica o tema salvo antes da renderização (evita "piscar" de tema)
try {
  const t = localStorage.getItem('wi-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch { /* armazenamento indisponível */ }

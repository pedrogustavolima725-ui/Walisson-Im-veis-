# Converte dist-demo/index.html em um fragmento de página (sem <html>/<head>/<body>)
# para publicação como link de demonstração.
import re, sys
src = open('dist-demo/index.html', encoding='utf-8').read()
out_path = sys.argv[1]
styles = re.findall(r'<style[^>]*>.*?</style>', src, re.S)
scripts = re.findall(r'<script[^>]*>.*?</script>', src, re.S)
fonts = re.findall(r'<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>', src)
parts = ['<title>Walisson Imóveis</title>', '<meta name="theme-color" content="#0f0d0b">', *fonts, *styles,
         '<style>html,body{background:var(--bg)}</style>', '<div id="root"></div>', *scripts]
open(out_path, 'w', encoding='utf-8').write('\n'.join(parts))
print(f'{out_path}: {sum(len(p) for p in parts)/1024:.0f} KB, {len(styles)} styles, {len(scripts)} scripts, {len(fonts)} font links')

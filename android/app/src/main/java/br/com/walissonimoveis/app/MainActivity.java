package br.com.walissonimoveis.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.Manifest;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.lang.ref.WeakReference;

/**
 * App Android da Walisson Imóveis: abre o app web publicado (BuildConfig.APP_URL)
 * em tela cheia, com envio de fotos, links externos (WhatsApp, telefone, e-mail),
 * botão voltar e tela própria para "sem conexão" / servidor iniciando.
 */
public class MainActivity extends Activity {
    private static final int FILE_REQUEST = 41;
    private static final int NOTIF_REQUEST = 42;
    private static WeakReference<MainActivity> current = new WeakReference<>(null);

    private WebView web;
    private ProgressBar progress;
    private ValueCallback<Uri[]> fileCallback;
    private String appHost;
    private boolean showingOffline = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        appHost = Uri.parse(BuildConfig.APP_URL).getHost();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0F0D0B"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0F0D0B"));
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 12);
        root.addView(progress, lp);
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setSupportMultipleWindows(false); // links "abrir em nova aba" ficam no mesmo fluxo
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " WalissonImoveisApp/" + BuildConfig.VERSION_NAME);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOffline(false);
            }

            // Servidor fora do ar, reiniciando ou ainda não publicado (404 na raiz, 5xx)
            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse response) {
                if (!request.isForMainFrame()) return;
                int code = response.getStatusCode();
                String path = request.getUrl().getPath();
                // 5xx: o servidor gratuito está acordando (leva até ~1 min) — tela "Iniciando..."
                if (code >= 500 || (code == 404 && (path == null || path.isEmpty() || path.equals("/")))) showOffline(code >= 500);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                progress.setVisibility(p < 100 ? View.VISIBLE : View.GONE);
            }

            // <input type="file"> do site: escolher fotos da galeria/câmera
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("image/*");
                pick.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {"image/jpeg", "image/png", "image/webp"});
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try {
                    startActivityForResult(Intent.createChooser(pick, "Escolher fotos"), FILE_REQUEST);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        // Relatórios (CSV) do CRM: baixa com a sessão do usuário
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (!url.startsWith("https://")) {
                Toast.makeText(this, "Este download não está disponível no app.", Toast.LENGTH_SHORT).show();
                return;
            }
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));
            req.addRequestHeader("User-Agent", userAgent);
            String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
            req.setTitle(name);
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(req);
            Toast.makeText(this, "Baixando " + name, Toast.LENGTH_SHORT).show();
        });

        // Ponte com o site: entrega o token do celular para ligar à conta logada
        web.addJavascriptInterface(new Bridge(), "WalissonApp");
        current = new WeakReference<>(this);

        String link = getIntent().getStringExtra("link");
        if (link != null) openLink(link);
        else if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else loadApp();

        setupPush();
    }

    /** Pede permissão (Android 13+) e obtém o token do Firebase. Sem Firebase configurado, o app segue sem push. */
    private void setupPush() {
        PushService.ensureChannel(this);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, NOTIF_REQUEST);
        }
        try {
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
                getSharedPreferences(PushService.PREFS, MODE_PRIVATE).edit().putString("token", token).apply();
                onPushToken(token);
            });
        } catch (IllegalStateException e) {
            // Firebase não configurado neste build
        }
    }

    /** Avisa o site (se aberto) que há um token novo. */
    static void onPushToken(String token) {
        MainActivity a = current.get();
        if (a == null || a.web == null) return;
        a.runOnUiThread(() -> a.web.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('wi-push-token',{detail:" + JSONObject.quote(token) + "}))", null));
    }

    /** Abre uma página do app (ex.: ao tocar numa notificação). Só caminhos internos. */
    private void openLink(String link) {
        if (link == null || !link.startsWith("/") || link.startsWith("//")) link = "/";
        showingOffline = false;
        progress.setVisibility(View.VISIBLE);
        web.loadUrl(BuildConfig.APP_URL + link);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String link = intent.getStringExtra("link");
        if (link != null) openLink(link);
    }

    private class Bridge {
        @JavascriptInterface
        public String getPushToken() {
            return getSharedPreferences(PushService.PREFS, MODE_PRIVATE).getString("token", "");
        }

        @JavascriptInterface
        public String getVersion() {
            return BuildConfig.VERSION_NAME;
        }
    }

    private void loadApp() {
        showingOffline = false;
        progress.setVisibility(View.VISIBLE);
        web.loadUrl(BuildConfig.APP_URL);
    }

    /** Tela própria quando não há conexão ou o servidor gratuito ainda está iniciando. */
    private void showOffline(boolean waking) {
        showingOffline = true;
        progress.setVisibility(View.GONE);
        web.loadUrl("file:///android_asset/offline.html" + (waking ? "?mode=waking" : ""));
    }

    /** Links do próprio app abrem aqui; WhatsApp, telefone, e-mail e outros sites abrem no app certo. */
    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        if (scheme.equals("file") && "retry".equals(uri.getQueryParameter("action"))) {
            loadApp();
            return true;
        }
        if ((scheme.equals("https")) && appHost != null && appHost.equalsIgnoreCase(uri.getHost())) return false;
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, uri);
            if (scheme.equals("tel")) i = new Intent(Intent.ACTION_DIAL, uri);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Nenhum app encontrado para abrir este link.", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_REQUEST && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    result = new Uri[n];
                    for (int i = 0; i < n; i++) result[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[] {data.getData()};
                }
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (showingOffline) {
            super.onBackPressed();
        } else if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}

package com.hj.premiummarket;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.Signature;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import java.security.MessageDigest;
import android.provider.Settings;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String SHOP_URL = "https://hj-premium-market-production.up.railway.app/";
    private static final String APK_URL = "https://hj-premium-market-production.up.railway.app/downloads/HJ-PREMIUM-MARKET.apk";
    private static final String PREFS = "hj_market_updater";
    private static final String KEY_DOWNLOAD_ID = "download_id";
    private static final String KEY_PENDING_START = "pending_start";
    private static final String KEY_MIGRATION_DOWNLOAD = "migration_download";
    private static final String RELEASE_CERT_SHA256 = "5A6A35B78A34032605EA083529A9F0C5BEE207257357DD29EAAD79B1EAAA52F3";
    private boolean pendingMigrationDownload = false;
    private WebView webView;
    private DownloadManager downloadManager;
    private BroadcastReceiver downloadReceiver;

    private final class AndroidBridge {
        @JavascriptInterface
        public int getVersionCode() {
            try {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                if (Build.VERSION.SDK_INT >= 28) return (int) info.getLongVersionCode();
                return info.versionCode;
            } catch (Exception error) {
                return 0;
            }
        }

        @JavascriptInterface
        public String getSignerSha256() {
            return signerSha256();
        }

        @JavascriptInterface
        public void downloadMigrationApk(String url) {
            runOnUiThread(() -> beginMigrationDownload(url));
        }

        @JavascriptInterface
        public String getVersionName() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception error) {
                return "";
            }
        }

        @JavascriptInterface
        public void updateApp(String url) {
            runOnUiThread(() -> beginUpdate(url));
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(16, 24, 39));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(16, 24, 39));
        downloadManager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
        registerDownloadReceiver();

        webView = new WebView(this);
        webView.setBackgroundColor(android.graphics.Color.rgb(245, 246, 250));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " HJPremiumMarketApp/1.0");
        webView.addJavascriptInterface(new AndroidBridge(), "HJAndroid");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    String host = uri.getHost() == null ? "" : uri.getHost();
                    if (host.equals("hj-premium-market-production.up.railway.app")) return false;
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                    return true;
                }
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                return true;
            }
        });
        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(SHOP_URL);
    }

    private boolean isAllowedApkUrl(String requestedUrl) {
        Uri uri = Uri.parse(requestedUrl == null || requestedUrl.isEmpty() ? APK_URL : requestedUrl);
        return "https".equals(uri.getScheme()) && "hj-premium-market-production.up.railway.app".equals(uri.getHost())
                && "/downloads/HJ-PREMIUM-MARKET.apk".equals(uri.getPath());
    }

    private String signerSha256() {
        try {
            PackageInfo info;
            if (Build.VERSION.SDK_INT >= 28) info = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            else info = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES);
            Signature[] signatures;
            if (Build.VERSION.SDK_INT >= 28) {
                signatures = info.signingInfo.hasMultipleSigners() ? info.signingInfo.getApkContentsSigners() : info.signingInfo.getSigningCertificateHistory();
            } else signatures = info.signatures;
            if (signatures == null || signatures.length == 0) return "";
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray());
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) hex.append(String.format(java.util.Locale.US, "%02X", b));
            return hex.toString();
        } catch (Exception error) { return ""; }
    }

    private void beginMigrationDownload(String requestedUrl) {
        if (!isAllowedApkUrl(requestedUrl)) {
            Toast.makeText(this, "Не удалось проверить адрес новой версии.", Toast.LENGTH_LONG).show();
            return;
        }
        if (Build.VERSION.SDK_INT <= 28 && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            pendingMigrationDownload = true;
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 731);
            return;
        }
        startApkDownload(true);
    }

    private void beginUpdate(String requestedUrl) {
        if (!isAllowedApkUrl(requestedUrl)) {
            Toast.makeText(this, "Не удалось проверить адрес обновления.", Toast.LENGTH_LONG).show();
            return;
        }
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            getPreferences(MODE_PRIVATE).edit().putBoolean(KEY_PENDING_START, true).apply();
            Toast.makeText(this, "Разрешите установку обновлений HJ PREMIUM MARKET.", Toast.LENGTH_LONG).show();
            Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName()));
            try { startActivity(settingsIntent); }
            catch (Exception error) {
                getPreferences(MODE_PRIVATE).edit().putBoolean(KEY_PENDING_START, false).apply();
                Toast.makeText(this, "Откройте настройки и разрешите установку неизвестных приложений.", Toast.LENGTH_LONG).show();
            }
            return;
        }
        startApkDownload(false);
    }

    private void startApkDownload(boolean migration) {
        SharedPreferences prefs = getPreferences(MODE_PRIVATE);
        long oldId = prefs.getLong(KEY_DOWNLOAD_ID, -1L);
        if (oldId != -1L && isDownloadRunning(oldId)) {
            Toast.makeText(this, "Обновление уже скачивается. Дождитесь уведомления.", Toast.LENGTH_LONG).show();
            return;
        }
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(APK_URL));
            request.setTitle("HJ PREMIUM MARKET — обновление");
            request.setDescription("Скачивание новой версии приложения");
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(false);
            if (migration) request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "HJ-PREMIUM-MARKET-new.apk");
            else request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "HJ-PREMIUM-MARKET-update.apk");
            long id = downloadManager.enqueue(request);
            prefs.edit().putLong(KEY_DOWNLOAD_ID, id).putBoolean(KEY_PENDING_START, false).putBoolean(KEY_MIGRATION_DOWNLOAD, migration).apply();
            Toast.makeText(this, "Загрузка обновления началась. Уведомление появится после скачивания.", Toast.LENGTH_LONG).show();
        } catch (Exception error) {
            Toast.makeText(this, "Не удалось начать загрузку. Проверьте интернет и повторите.", Toast.LENGTH_LONG).show();
        }
    }

    private boolean isDownloadRunning(long id) {
        try {
            DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
            android.database.Cursor cursor = downloadManager.query(query);
            if (cursor == null) return false;
            try {
                if (!cursor.moveToFirst()) return false;
                int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                return status == DownloadManager.STATUS_PENDING || status == DownloadManager.STATUS_RUNNING
                        || status == DownloadManager.STATUS_PAUSED;
            } finally { cursor.close(); }
        } catch (Exception error) { return false; }
    }

    private void registerDownloadReceiver() {
        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                long expected = getPreferences(MODE_PRIVATE).getLong(KEY_DOWNLOAD_ID, -2L);
                if (id == expected) installDownloadedApk(id);
            }
        };
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(downloadReceiver, filter);
    }

    private void installDownloadedApk(long id) {
        try {
            DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
            android.database.Cursor cursor = downloadManager.query(query);
            if (cursor == null) return;
            int status;
            try {
                if (!cursor.moveToFirst()) return;
                status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            } finally { cursor.close(); }
            SharedPreferences prefs = getPreferences(MODE_PRIVATE);
            boolean migration = prefs.getBoolean(KEY_MIGRATION_DOWNLOAD, false);
            if (status != DownloadManager.STATUS_SUCCESSFUL) {
                prefs.edit().remove(KEY_DOWNLOAD_ID).putBoolean(KEY_MIGRATION_DOWNLOAD, false).apply();
                Toast.makeText(this, "Не удалось скачать обновление. Попробуйте ещё раз.", Toast.LENGTH_LONG).show();
                return;
            }
            if (migration) {
                prefs.edit().remove(KEY_DOWNLOAD_ID).putBoolean(KEY_MIGRATION_DOWNLOAD, false).apply();
                Toast.makeText(this, "Новая версия скачана в папку «Загрузки». Удалите старое приложение, затем откройте файл HJ-PREMIUM-MARKET-new.apk для установки.", Toast.LENGTH_LONG).show();
                return;
            }
            if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                getPreferences(MODE_PRIVATE).edit().putBoolean(KEY_PENDING_START, true).apply();
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName())));
                return;
            }
            Uri apkUri = downloadManager.getUriForDownloadedFile(id);
            if (apkUri == null) throw new IllegalStateException("APK download URI is missing");
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(apkUri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(install);
            getPreferences(MODE_PRIVATE).edit().remove(KEY_DOWNLOAD_ID).putBoolean(KEY_PENDING_START, false).apply();
        } catch (Exception error) {
            Toast.makeText(this, "Скачивание завершено. Откройте уведомление загрузки, чтобы установить APK.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 731 && pendingMigrationDownload) {
            pendingMigrationDownload = false;
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) startApkDownload(true);
            else Toast.makeText(this, "Без разрешения Android не сможет сохранить APK в папку «Загрузки».", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        SharedPreferences prefs = getPreferences(MODE_PRIVATE);
        if (prefs.getBoolean(KEY_PENDING_START, false)
                && (Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls())) {
            prefs.edit().putBoolean(KEY_PENDING_START, false).apply();
            long id = prefs.getLong(KEY_DOWNLOAD_ID, -1L);
            if (id > 0) installDownloadedApk(id);
            else startApkDownload(false);
        } else {
            long id = prefs.getLong(KEY_DOWNLOAD_ID, -1L);
            if (id > 0) {
                DownloadManager.Query query = new DownloadManager.Query().setFilterById(id);
                android.database.Cursor cursor = downloadManager.query(query);
                if (cursor != null) {
                    try {
                        if (cursor.moveToFirst() && cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) == DownloadManager.STATUS_SUCCESSFUL)
                            installDownloadedApk(id);
                    } finally { cursor.close(); }
                }
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        if (downloadReceiver != null) {
            try { unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
            downloadReceiver = null;
        }
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}

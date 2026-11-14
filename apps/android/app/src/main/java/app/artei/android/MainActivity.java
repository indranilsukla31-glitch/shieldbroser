package app.artei.android;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.text.InputType;
import android.util.Base64;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Artei for Android (beta): a thin, full-screen WebView around your own Artei
 * server. Everything else (music, visuals, YouTube mode) is the web app.
 */
public class MainActivity extends Activity {
    private static final String PREFS = "artei";
    private static final String KEY_URL = "server_url";

    private FrameLayout root;
    private WebView web;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private String serverUrl;
    private final Chrome chrome = new Chrome();

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        root.setBackgroundColor(0xFF07060B);
        setContentView(root);
        serverUrl = prefs().getString(KEY_URL, null);
        if (serverUrl == null) showSetup(null);
        else showWeb(state);
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    // ---------- First-run / change-address screen ----------

    private void showSetup(String message) {
        destroyWeb();
        root.removeAllViews();
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(28), dp(72), dp(28), dp(28));

        TextView logo = text("artei.", 48, 0xFFF4F1FB, true);
        col.addView(logo);
        TextView sub = text("Beta for Android", 15, 0xFFB9B3C9, false);
        sub.setPadding(0, 0, 0, dp(28));
        col.addView(sub);

        TextView label = text("Your Artei address", 14, 0xFFF4F1FB, true);
        col.addView(label);

        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        input.setImeOptions(EditorInfo.IME_ACTION_GO);
        input.setHint("https://your-artei.onrender.com");
        input.setTextColor(0xFFF4F1FB);
        input.setHintTextColor(0xFF7D7690);
        input.setPadding(dp(16), dp(14), dp(16), dp(14));
        GradientDrawable box = new GradientDrawable();
        box.setColor(0xFF181522);
        box.setCornerRadius(dp(16));
        box.setStroke(dp(1), 0x33FFFFFF);
        input.setBackground(box);
        String saved = prefs().getString(KEY_URL, "");
        input.setText(saved);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(8);
        col.addView(input, lp);

        TextView help = text(
                "Use the address where Artei runs:\n"
                        + "• Online (Render): https://….onrender.com\n"
                        + "• A computer on your Wi-Fi: http://192.168.x.x:8787",
                13, 0xFFB9B3C9, false);
        help.setPadding(0, dp(12), 0, 0);
        col.addView(help);

        if (message != null) {
            TextView err = text(message, 13, 0xFFFFB36B, false);
            err.setPadding(0, dp(12), 0, 0);
            col.addView(err);
        }

        Button go = new Button(this);
        go.setText("Connect");
        go.setAllCaps(false);
        go.setTextSize(16);
        go.setTypeface(Typeface.DEFAULT_BOLD);
        go.setTextColor(0xFF07060B);
        GradientDrawable pill = new GradientDrawable();
        pill.setColor(0xFFF4F1FB);
        pill.setCornerRadius(dp(28));
        go.setBackground(pill);
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56));
        bp.topMargin = dp(28);
        col.addView(go, bp);

        Runnable connect = () -> {
            String url = normalise(input.getText().toString());
            if (url == null) {
                Toast.makeText(this, "Enter an address like https://artei.onrender.com", Toast.LENGTH_LONG).show();
                return;
            }
            prefs().edit().putString(KEY_URL, url).apply();
            serverUrl = url;
            showWeb(null);
        };
        go.setOnClickListener(v -> connect.run());
        input.setOnEditorActionListener((v, actionId, event) -> {
            connect.run();
            return true;
        });

        root.addView(col, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    /** Accepts "artei.onrender.com", "192.168.1.5:8787" etc. Returns null if unusable. */
    static String normalise(String raw) {
        String s = raw == null ? "" : raw.trim();
        if (s.isEmpty() || s.contains(" ")) return null;
        if (!s.startsWith("http://") && !s.startsWith("https://")) {
            boolean local = s.matches("^(localhost|10\\.|192\\.168\\.|172\\.(1[6-9]|2\\d|3[01])\\.).*");
            s = (local ? "http://" : "https://") + s;
        }
        Uri u = Uri.parse(s);
        if (u.getHost() == null || u.getHost().isEmpty()) return null;
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        return s;
    }

    // ---------- The app itself ----------

    private void showWeb(Bundle state) {
        root.removeAllViews();
        web = new WebView(this);
        web.setBackgroundColor(0xFF07060B);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        ws.setSupportMultipleWindows(false);
        ws.setUserAgentString(ws.getUserAgentString() + " ArteiAndroid/0.1");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "ArteiAndroid");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(chrome);
        web.setDownloadListener((url, ua, disposition, mime, length) -> download(url, mime));

        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (state != null && web.restoreState(state) != null) return;
        web.loadUrl(serverUrl + "/");
    }

    private void destroyWeb() {
        if (web != null) {
            root.removeView(web);
            web.destroy();
            web = null;
        }
    }

    private boolean isOurs(Uri uri) {
        Uri base = Uri.parse(serverUrl);
        return uri.getHost() != null && uri.getHost().equalsIgnoreCase(base.getHost()) && uri.getPort() == base.getPort();
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            if (!req.isForMainFrame()) return false;
            Uri uri = req.getUrl();
            if (isOurs(uri)) return false;
            // License deeds, Jamendo/Archive pages, "Open in YouTube" → the right app or browser.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException e) {
                Toast.makeText(MainActivity.this, "No app can open that link.", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
            if (!req.isForMainFrame()) return;
            showSetup("Couldn't reach " + serverUrl + " (" + err.getDescription() + "). Check the address, "
                    + "that the server is running, and that your phone is online.");
        }
    }

    /** Lets YouTube's fullscreen button take over the screen. */
    private class Chrome extends WebChromeClient {
        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (customView != null) {
                callback.onCustomViewHidden();
                return;
            }
            customView = view;
            customCallback = callback;
            root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        }

        @Override
        public void onHideCustomView() {
            if (customView == null) return;
            root.removeView(customView);
            customView = null;
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            if (customCallback != null) customCallback.onCustomViewHidden();
            customCallback = null;
        }
    }

    // ---------- Saving clips and DNA cards ----------

    private void download(String url, String mime) {
        if (url.startsWith("blob:") || url.startsWith("data:")) {
            // WebView can't download blob: URLs itself, so read the blob in the page and hand it over.
            String js = "(async()=>{try{const b=await (await fetch('" + url.replace("'", "\\'") + "')).blob();"
                    + "const r=new FileReader();r.onload=()=>ArteiAndroid.save(r.result.split(',')[1],b.type||'" + mime + "');"
                    + "r.readAsDataURL(b);}catch(e){ArteiAndroid.failed(String(e));}})()";
            web.evaluateJavascript(js, null);
        } else {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        }
    }

    private class Bridge {
        @JavascriptInterface
        public void save(String base64, String mime) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                String ext = mime.contains("mp4") ? "mp4" : mime.contains("webm") ? "webm" : mime.contains("png") ? "png" : mime.contains("jpeg") ? "jpg" : "bin";
                String name = "artei-" + System.currentTimeMillis() + "." + ext;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    v.put(MediaStore.Downloads.MIME_TYPE, mime);
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Artei");
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        out.write(bytes);
                    }
                } else {
                    File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Artei");
                    dir.mkdirs();
                    try (FileOutputStream out = new FileOutputStream(new File(dir, name))) {
                        out.write(bytes);
                    }
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved to Downloads/Artei", Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                failed(e.getMessage());
            }
        }

        @JavascriptInterface
        public void failed(String why) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Couldn't save: " + why, Toast.LENGTH_LONG).show());
        }
    }

    // ---------- Lifecycle ----------

    @Override
    public void onBackPressed() {
        if (customView != null) {
            chrome.onHideCustomView();
            return;
        }
        if (web != null && web.canGoBack()) {
            web.goBack();
            return;
        }
        if (web == null) {
            if (serverUrl != null) showWeb(null);
            else super.onBackPressed();
            return;
        }
        new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                .setTitle("Leave Artei?")
                .setPositiveButton("Exit", (d, w) -> finish())
                .setNeutralButton("Change address", (d, w) -> showSetup(null))
                .setNegativeButton("Stay", null)
                .show();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    // Deliberately no web.onPause() in onPause(): music keeps playing when you switch apps or lock the screen.

    @Override
    protected void onDestroy() {
        destroyWeb();
        super.onDestroy();
    }

}

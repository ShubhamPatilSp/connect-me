package app.connexa.khandesh;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.google.firebase.FirebaseException;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.firebase.auth.AuthCredential;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.PhoneAuthCredential;
import com.google.firebase.auth.PhoneAuthOptions;
import com.google.firebase.auth.PhoneAuthProvider;

import java.util.concurrent.TimeUnit;

/**
 * Native shell for Connexa.
 *
 * Two jobs:
 *
 *  1. Host the server-rendered client in a hardened WebView — back button walks
 *     history, file upload opens the system picker, cleartext HTTP is allowed for
 *     a LAN server, and an unreachable server drops to the connect screen.
 *
 *  2. Own phone authentication. Firebase's Android SDK verifies the app through
 *     Play Integrity and can auto-retrieve the SMS code, neither of which works
 *     reliably in a WebView. The web layer calls into this bridge, and the ID
 *     token it hands back is exchanged for a session by the backend.
 */
public class MainActivity extends Activity {

    private static final String PREFS = "connexa";
    private static final String KEY_SERVER = "server_url";
    private static final int REQ_FILE = 1001;
    private static final int REQ_GOOGLE = 1002;

    /** Web OAuth client for this Firebase project (public identifier, not a secret). */
    private static final String WEB_CLIENT_ID =
            "914191811414-j9i2t4h6b0egg9p4s2u1dl3q21oh4t94.apps.googleusercontent.com";
    private static final String SETUP_URL = "file:///android_asset/setup.html";
    private static final String TAG = "ConnexaAuth";

    private WebView web;
    private ValueCallback<Uri[]> pendingFiles;
    private String verificationId;
    private GoogleSignInClient googleClient;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(Color.parseColor("#0A0A0B"));
        setContentView(web);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " ConnexaAndroid/1.1");

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                if (scheme.equals("http") || scheme.equals("https") || scheme.equals("file")) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    // No handler for this scheme.
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showSetup("Can't reach that server. Check the address and try again.");
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (pendingFiles != null) {
                    pendingFiles.onReceiveValue(null);
                }
                pendingFiles = callback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                if (params != null && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(Intent.createChooser(intent, "Select photos"), REQ_FILE);
                } catch (Exception e) {
                    pendingFiles = null;
                    return false;
                }
                return true;
            }
        });

        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(WEB_CLIENT_ID)
                .requestEmail()
                .build();
        googleClient = GoogleSignIn.getClient(this, gso);

        String saved = prefs().getString(KEY_SERVER, "");
        if (saved == null || saved.isEmpty()) {
            showSetup(null);
        } else {
            web.loadUrl(saved);
        }
    }

    // ── Firebase phone auth ─────────────────────────────────────────────────

    /** Normalise Indian numbers to E.164; Firebase requires the country code. */
    private static String toE164(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("[^0-9+]", "");
        if (digits.startsWith("+")) return digits;
        if (digits.length() == 10) return "+91" + digits;
        if (digits.length() == 11 && digits.startsWith("0")) return "+91" + digits.substring(1);
        if (digits.length() == 12 && digits.startsWith("91")) return "+" + digits;
        return digits;
    }

    private void startPhoneAuth(String rawNumber) {
        final String number = toE164(rawNumber);
        if (number.isEmpty()) {
            callJs("onError", "Enter a valid mobile number");
            return;
        }

        PhoneAuthOptions options = PhoneAuthOptions.newBuilder(FirebaseAuth.getInstance())
                .setPhoneNumber(number)
                .setTimeout(60L, TimeUnit.SECONDS)
                .setActivity(this)
                .setCallbacks(new PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                    @Override
                    public void onVerificationCompleted(@NonNull PhoneAuthCredential credential) {
                        // Auto-retrieval succeeded — no code entry needed.
                        signIn(credential);
                    }

                    @Override
                    public void onVerificationFailed(@NonNull FirebaseException e) {
                        Log.w(TAG, "verification failed", e);
                        String message = e.getMessage() == null ? "Verification failed" : e.getMessage();
                        callJs("onError", message.replace("\n", " "));
                    }

                    @Override
                    public void onCodeSent(@NonNull String id,
                                           @NonNull PhoneAuthProvider.ForceResendingToken token) {
                        verificationId = id;
                        callJs("onCodeSent", null);
                    }
                })
                .build();

        PhoneAuthProvider.verifyPhoneNumber(options);
    }

    private void confirmCode(String code) {
        if (verificationId == null) {
            callJs("onError", "Request a code first");
            return;
        }
        signIn(PhoneAuthProvider.getCredential(verificationId, code.trim()));
    }

    private void signIn(AuthCredential credential) {
        FirebaseAuth.getInstance().signInWithCredential(credential)
                .addOnCompleteListener(this, task -> {
                    if (!task.isSuccessful()) {
                        String message = task.getException() == null
                                ? "Sign-in failed"
                                : task.getException().getMessage();
                        callJs("onError", message == null ? "Sign-in failed" : message.replace("\n", " "));
                        return;
                    }
                    FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
                    if (user == null) {
                        callJs("onError", "Sign-in failed");
                        return;
                    }
                    user.getIdToken(false).addOnCompleteListener(this, tokenTask -> {
                        if (!tokenTask.isSuccessful() || tokenTask.getResult() == null) {
                            callJs("onError", "Could not get a token");
                            return;
                        }
                        callJs("onToken", tokenTask.getResult().getToken());
                    });
                });
    }

    // ── Google Sign-In ──────────────────────────────────────────────────────

    private void startGoogleSignIn() {
        if (googleClient == null) {
            callJs("onError", "Google sign-in is not available");
            return;
        }
        // Force the account picker instead of silently reusing a cached account.
        googleClient.signOut().addOnCompleteListener(task ->
                runOnUiThread(() -> startActivityForResult(googleClient.getSignInIntent(), REQ_GOOGLE)));
    }

    private void handleGoogleResult(Intent data) {
        try {
            GoogleSignInAccount account = GoogleSignIn.getSignedInAccountFromIntent(data)
                    .getResult(ApiException.class);
            String idToken = account == null ? null : account.getIdToken();
            if (idToken == null) {
                callJs("onError", "Google did not return an ID token");
                return;
            }
            firebaseAuthWithGoogle(idToken);
        } catch (ApiException e) {
            // Status 12501 = user cancelled; stay quiet rather than showing an error.
            if (e.getStatusCode() == 12501) {
                callJs("onCancelled", null);
                return;
            }
            Log.w(TAG, "google sign-in failed", e);
            callJs("onError", "Google sign-in failed (" + e.getStatusCode() + ")");
        }
    }

    private void firebaseAuthWithGoogle(String googleIdToken) {
        AuthCredential credential = GoogleAuthProvider.getCredential(googleIdToken, null);
        if (credential == null) {
            callJs("onError", "Could not verify the Google account");
            return;
        }
        signIn(credential);
    }

    /** Invoke a callback the web layer registers as `window.ConnexaNative`. */    private void callJs(String method, String arg) {
        String payload;
        if (arg == null) {
            payload = "";
        } else {
            payload = "'" + arg.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ") + "'";
        }
        final String script =
                "(function(){try{var b=window.ConnexaNative;if(b&&b." + method + ")b." + method + "(" + payload + ");}catch(e){}})();";
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript(script, null);
        });
    }

    // ── Activity plumbing ───────────────────────────────────────────────────

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_GOOGLE) {
            handleGoogleResult(data);
            return;
        }
        if (requestCode == REQ_FILE) {
            if (pendingFiles == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            pendingFiles.onReceiveValue(results);
            pendingFiles = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("AndroidBridge");
            web.destroy();
        }
        super.onDestroy();
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void showSetup(String error) {
        String url = SETUP_URL;
        if (error != null && !error.isEmpty()) {
            url = url + "?error=" + Uri.encode(error);
        }
        web.loadUrl(url);
    }

    /** Exposed to JavaScript as `window.AndroidBridge`. */
    private class Bridge {

        @JavascriptInterface
        public String getServer() {
            return prefs().getString(KEY_SERVER, "");
        }

        @JavascriptInterface
        public void setServer(String url) {
            if (url == null) return;
            String clean = url.trim();
            if (clean.isEmpty()) return;
            if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
                clean = "http://" + clean;
            }
            while (clean.endsWith("/")) {
                clean = clean.substring(0, clean.length() - 1);
            }
            prefs().edit().putString(KEY_SERVER, clean).apply();
            final String target = clean;
            runOnUiThread(() -> web.loadUrl(target));
        }

        @JavascriptInterface
        public void clearServer() {
            prefs().edit().remove(KEY_SERVER).apply();
        }

        @JavascriptInterface
        public void toast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }

        /** True when the native Firebase flow is available to the web layer. */
        @JavascriptInterface
        public boolean hasNativeAuth() {
            return true;
        }

        @JavascriptInterface
        public void startPhoneAuth(String phone) {
            runOnUiThread(() -> MainActivity.this.startPhoneAuth(phone));
        }

        @JavascriptInterface
        public void signInWithGoogle() {
            runOnUiThread(() -> MainActivity.this.startGoogleSignIn());
        }

        @JavascriptInterface
        public void confirmPhoneCode(String code) {
            runOnUiThread(() -> MainActivity.this.confirmCode(code));
        }

        @JavascriptInterface
        public void signOut() {
            runOnUiThread(() -> FirebaseAuth.getInstance().signOut());
        }
    }
}

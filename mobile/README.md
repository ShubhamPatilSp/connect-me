# Connect Me — Android client

A native Android shell around the Connect Me app, built with the Android Gradle
Plugin and **no third-party dependencies** (no AndroidX, no Capacitor). The whole
client is one activity plus a connect screen.

```
android/
├─ app/src/main/java/app/connexa/khandesh/MainActivity.java
├─ app/src/main/assets/setup.html        connect screen (server address)
├─ app/src/main/res/                     theme, launcher icon, strings
├─ app/build.gradle                      minSdk 26 · targetSdk 34 · Java 17
└─ local.properties                      sdk.dir (not committed)
```

## Why a WebView shell

Connect Me is server-rendered: auth, the matching engine, and chat all live behind
`/api/*`. An APK cannot bundle a Node server, so the correct architecture is a
native client that talks to a deployed instance — which is how every thin-client
mobile app works. This shell hardens the WebView where a naive one fails:

| Problem | Handling |
|---|---|
| Android back closes the app mid-chat | `onBackPressed` walks WebView history first |
| `<input type="file">` does nothing | `onShowFileChooser` opens the system photo picker, multi-select supported |
| LAN server has no TLS certificate | cleartext HTTP allowed via `usesCleartextTraffic` |
| Server unreachable | `onReceivedError` drops to the setup screen instead of a browser error page |
| Address lost between launches | stored in `SharedPreferences` through a JS bridge |
| Keyboard covers the chat composer | `adjustResize` |

## Build

Requires JDK 17 and the Android SDK (platform 34 + build-tools 34.0.0).

```bash
cd mobile/android
gradle assembleDebug          # or: ./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

Point `local.properties` at your SDK:

```properties
sdk.dir=C\:\\AndroidTools\\sdk
```

## Install and run

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

On first launch the app asks for the server address. Start the backend on your
computer (`cd app && npm start`) and enter the machine's LAN address, e.g.
`http://192.168.1.42:3000`. The phone must be on the same Wi-Fi.

To bake the address in and skip the setup screen, set `KEY_SERVER` in
`MainActivity` before the `prefs()` read, or ship a variant with a fixed
`server_url` default.

## Release

The `release` build type is signed with the debug key so it installs for
side-loading. Before publishing to Play, generate a keystore and swap
`signingConfigs.debug` for it:

```bash
keytool -genkey -v -keystore connexa.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias connexa
```

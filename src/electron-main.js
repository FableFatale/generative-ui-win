// Electron main process for generative-ui-win
// Usage: electron electron-main.js <url>
// Options are passed as query parameters: ?_title=T&_width=W&_height=H

const { app, BrowserWindow } = require("electron");

// Get URL from argv — the first non-flag argument after the script path
var url = null;
var args = process.argv.slice(2);
for (var i = 0; i < args.length; i++) {
  if (!args[i].startsWith("-")) {
    url = args[i];
    break;
  }
}

if (!url) {
  process.stderr.write("Usage: electron electron-main.js <url>\n");
  process.exit(1);
}

// Parse options from URL query string
var urlObj = new URL(url);
var title = urlObj.searchParams.get("_title") || "Widget";
var width = parseInt(urlObj.searchParams.get("_width") || "800", 10);
var height = parseInt(urlObj.searchParams.get("_height") || "600", 10);

// Remove our custom params from the URL before loading
urlObj.searchParams.delete("_title");
urlObj.searchParams.delete("_width");
urlObj.searchParams.delete("_height");
var cleanUrl = urlObj.toString();

app.whenReady().then(function () {
  var win = new BrowserWindow({
    width: width,
    height: height,
    title: title,
    backgroundColor: "#1a1a1a",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(cleanUrl);

  win.on("closed", function () {
    app.quit();
  });
});

app.on("window-all-closed", function () {
  app.quit();
});

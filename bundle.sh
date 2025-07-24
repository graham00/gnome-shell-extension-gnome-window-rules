UUID="gnome-window-rules@graham00.github.com"
ZIPFILES="extension.js prefs.js metadata.json schemas locale COPYING"

glib-compile-schemas ./schemas/
zip -qr "$UUID.zip" $ZIPFILES

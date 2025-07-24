# gnome-shell-extension-gnome-window-rules
Makes windows matching user-defined patterns sticky (ie, visible on all workspaces), always-on-top, or both. GNOME allows you to manually set this per-window without this extension, but it doesn't *remember* the setting. This extension is useful to work around wayland's lack of direct support for this, when you need these attributes set automatically for important application alert windows you can't miss not seeing as you are swapping between windows and workspaces.

I needed this for alert windows, but most of this was derived from Rafostar's "gnome-shell-extension-pip-on-top" extension. If all you want is to specifically make picture-in-picture windows always be on top, you should use that.

## Features
- **Regex Pattern Matching**: Use regular expressions to match window titles or window classes
- **Flexible Matching**: Choose whether to match against window title or window class
- **Multiple Behaviors**: Apply sticky (show on all workspaces), always-on-top, or both
- **Multiple Rules**: Configure multiple rules for different window types
- **Real-time Updates**: Rules are applied immediately when windows are created or titles change

## Usage
1. Open GNOME Extensions and go to the preferences for "GNOME Window Rules"
2. Click "Add Rule" to create a new window rule
3. Configure each rule:
   - **Pattern**: Enter a regex pattern to match (e.g., `AppName Alert`, `.*YouTube.*`, `org.org.importantapp`)
   - **Match Type**: Choose whether to match the above against the "Window Title" or the "Window Class"
   - **Behavior**: Enable "Sticky" and/or "Always on Top" as needed
4. Rules are applied in order - the first matching rule will be used

## Finding Window Information (so you know what pattern to use)
To determine the precise window title or window class, press Alt+F2, type "lg" ("Looking Glass"), then click the "Windows" tab.

## Installation from source code
Run below in terminal one by one:
```sh
mkdir -p ~/.local/share/gnome-shell/extensions
cd ~/.local/share/gnome-shell/extensions
git clone "https://github.com/graham00/gnome-shell-extension-gnome-window-rules.git" "gnome-window-rules@graham00.github.com"
cd gnome-window-rules@graham00.github.com
glib-compile-schemas ./schemas/
```
Then log out or reboot, log back in, search for "extensions" in gnome and configure and enable it.

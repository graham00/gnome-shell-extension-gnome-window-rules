/*
 * GNOME Shell Extension: GNOME Window Rules
 * Developer: Graham00, derived from gnome-shell-extension-pip-on-top by Rafostar
 */

import Meta from 'gi://Meta';
import GLib from 'gi://GLib';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class WindowRules extends Extension
{
  enable()
  {
    // Use WeakMap to track window state without creating strong references
    this._windowData = new WeakMap();
    
    this.settings = this.getSettings();
    this._settingsChangedId = this.settings.connect(
      'changed', this._onSettingsChanged.bind(this));

    // Connect to display signals for window management
    this._displayWindowCreatedId = global.display.connect(
      'window-created', this._onWindowCreated.bind(this));

    this._switchWorkspaceId = global.window_manager.connect_after(
      'switch-workspace', this._onSwitchWorkspace.bind(this));
    this._onSwitchWorkspace();
  }

  disable()
  {
    this.settings.disconnect(this._settingsChangedId);
    this.settings = null;

    global.window_manager.disconnect(this._switchWorkspaceId);
    global.display.disconnect(this._displayWindowCreatedId);

    // Clean up all timeout sources from WeakMap
    if (this._windowData) {
      for (let [window, windowData] of this._windowData) {
        if (windowData.timeoutId) {
          GLib.source_remove(windowData.timeoutId);
        }
      }
    }

    // Clean up all window signal connections
    let actors = global.get_window_actors();
    if (actors) {
      for (let actor of actors) {
        let window = actor.meta_window;
        if (!window) continue;

        let windowData = this._windowData.get(window);
        if (windowData) {
          // Disconnect window signals
          if (windowData.notifyId) {
            try {
              window.disconnect(windowData.notifyId);
            } catch (e) {
              // Window might be destroyed, ignore errors
            }
          }
        }
      }
    }

    // Clear the WeakMap to allow garbage collection
    this._windowData = null;
    this._settingsChangedId = 0;
    this._switchWorkspaceId = 0;
    this._displayWindowCreatedId = 0;
  }

  _onSettingsChanged(settings, key)
  {
    switch (key) {
      case 'window-rules':
        /* Updates already present windows */
        this._onSwitchWorkspace();
        break;
      default:
        break;
    }
  }

  _onWindowCreated(display, window)
  {
    // This signal is emitted when a new window is created
    this._onWindowAdded(window);
  }

  _onSwitchWorkspace()
  {
    let workspace = global.workspace_manager.get_active_workspace();
    let wsWindows = global.display.get_tab_list(Meta.TabList.NORMAL, workspace);

    /* Update state on already present windows without adding them to WeakMap */
    if (wsWindows) {
      for (let window of wsWindows) {
        // Only check rules, don't add to WeakMap yet
        this._checkWindowRules(window);
      }
    }
  }

  _onWindowAdded(window)
  {
    // Skip windows that are being destroyed
    try {
      if (!window || window.get_display() === null) {
        return;
      }
    } catch (e) {
      // Window is being destroyed
      return;
    }

    // Get or create window data
    let windowData = this._windowData.get(window);
    if (!windowData) {
      windowData = {
        notifyId: 0,
        hasRules: false,
        timeoutId: 0
      };
      this._windowData.set(window, windowData);
    }

    // Connect to title changes if not already connected
    if (!windowData.notifyId) {
      try {
        windowData.notifyId = window.connect_after(
          'notify::title', this._checkWindowRules.bind(this));
      } catch (e) {
        // Window might be destroyed, ignore errors
        console.log(`Window Rules: Error connecting to window signal: ${e.message}`);
        return;
      }
    }

    // Remove existing timeout if any
    if (windowData.timeoutId) {
      GLib.source_remove(windowData.timeoutId);
      windowData.timeoutId = 0;
    }

    // Apply rules after a short delay to ensure window is fully initialized
    windowData.timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      this._checkWindowRules(window);
      windowData.timeoutId = 0;
      return false; // Don't repeat
    });
  }

  _checkWindowRules(window)
  {
    // Skip invalid windows
    if (!window) {
      return;
    }

    // Skip windows that are being destroyed or are invalid
    try {
      if (window.get_display() === null || !window.get_workspace()) {
        return;
      }
    } catch (e) {
      // Window is being destroyed
      return;
    }

    // Skip windows that aren't fully initialized yet
    if (!window.title && !window.get_wm_class()) {
      return;
    }

    const rules = this.settings.get_value('window-rules').deep_unpack();
    
    if (rules.length === 0) {
      // No rules configured, remove any existing window rules
      let windowData = this._windowData.get(window);
      if (windowData && windowData.hasRules) {
        if (window.above)
          window.unmake_above();
        if (window.on_all_workspaces)
          window.unstick();
        windowData.hasRules = false;
      }
      return;
    }

    let matchedRule = null;

    for (let rule of rules) {
      const pattern = rule.pattern ? rule.pattern.unpack() : '';
      const type = rule.type ? rule.type.unpack() : 'title';
      const sticky = rule.sticky ? rule.sticky.unpack() : false;
      const above = rule.above ? rule.above.unpack() : false;
      
      if (!pattern || pattern.trim() === '') {
        continue;
      }

      let textToMatch = '';
      if (type === 'title') {
        textToMatch = window.title || '';
      } else if (type === 'class') {
        textToMatch = window.get_wm_class() || '';
      }

      if (textToMatch === '') {
        continue;
      }

      try {
        const regex = new RegExp(pattern, 'i'); // Case insensitive
        if (regex.test(textToMatch)) {
          matchedRule = { pattern, type, sticky, above };
          break;
        }
      } catch (e) {
        console.log(`Window Rules: Invalid regex pattern "${pattern}": ${e.message}`);
        continue;
      }
    }

    let windowData = this._windowData.get(window);
    if (!windowData) return;

    if (matchedRule) {
      windowData.hasRules = true;
      //log(`Window Rules: Applying rules to ${window.title || 'Unknown'}: sticky=${matchedRule.sticky}, above=${matchedRule.above}`);

      try {
        // Apply sticky behavior
        if (matchedRule.sticky) {
          if (!window.on_all_workspaces) {
            window.stick();
          }
        } else {
          if (window.on_all_workspaces) {
            window.unstick();
          }
        }

        // Apply above behavior
        if (matchedRule.above) {
          if (!window.above) {
            window.make_above();
          }
        } else {
          if (window.above) {
            window.unmake_above();
          }
        }
      } catch (e) {
        console.log(`Window Rules: Error applying rules to ${window.title || 'Unknown'}: ${e.message}`);
        // Don't mark as having rules if we couldn't apply them
        windowData.hasRules = false;
      }
    } else {
      // No matching rule, remove any existing window rules
      if (windowData.hasRules) {
        //log(`Window Rules: Removing rules from ${window.title || 'Unknown'}`);
        console.log(`Window Rules: Removing rules from ${window.title || 'Unknown'}`);
        try {
          if (window.above)
            window.unmake_above();
          if (window.on_all_workspaces)
            window.unstick();
        } catch (e) {
          console.log(`Window Rules: Error removing rules from ${window.title || 'Unknown'}: ${e.message}`);
        }
        windowData.hasRules = false;
      }
    }
  }
}

/*
 * GNOME Shell Extension: GNOME Window Rules
 * Developer: Graham00, derived from gnome-shell-extension-pip-on-top by Rafostar
 */

import Meta from 'gi://Meta';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class WindowRules extends Extension
{
  enable()
  {
    this._lastWorkspace = null;
    this._windowAddedId = 0;
    this._windowRemovedId = 0;

    this.settings = this.getSettings();
    this._settingsChangedId = this.settings.connect(
      'changed', this._onSettingsChanged.bind(this));

    this._switchWorkspaceId = global.window_manager.connect_after(
      'switch-workspace', this._onSwitchWorkspace.bind(this));
    this._onSwitchWorkspace();
  }

  disable()
  {
    this.settings.disconnect(this._settingsChangedId);
    this.settings = null;

    global.window_manager.disconnect(this._switchWorkspaceId);

    if (this._lastWorkspace) {
      this._lastWorkspace.disconnect(this._windowAddedId);
      this._lastWorkspace.disconnect(this._windowRemovedId);
    }

    this._lastWorkspace = null;
    this._settingsChangedId = 0;
    this._switchWorkspaceId = 0;
    this._windowAddedId = 0;
    this._windowRemovedId = 0;

    let actors = global.get_window_actors();
    if (actors) {
      for (let actor of actors) {
        let window = actor.meta_window;
        if (!window) continue;

        if (window._hasWindowRules) {
          if (window.above)
            window.unmake_above();
          if (window.on_all_workspaces)
            window.unstick();
        }

        this._onWindowRemoved(null, window);
      }
    }
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

  _onSwitchWorkspace()
  {
    let workspace = global.workspace_manager.get_active_workspace();
    let wsWindows = global.display.get_tab_list(Meta.TabList.NORMAL, workspace);

    if (this._lastWorkspace) {
      this._lastWorkspace.disconnect(this._windowAddedId);
      this._lastWorkspace.disconnect(this._windowRemovedId);
    }

    this._lastWorkspace = workspace;
    this._windowAddedId = this._lastWorkspace.connect(
      'window-added', this._onWindowAdded.bind(this));
    this._windowRemovedId = this._lastWorkspace.connect(
      'window-removed', this._onWindowRemoved.bind(this));

    /* Update state on already present windows */
    if (wsWindows) {
      for (let window of wsWindows)
        this._onWindowAdded(workspace, window);
    }
  }

  _onWindowAdded(workspace, window)
  {
    if (!window._notifyWindowRulesId) {
      window._notifyWindowRulesId = window.connect_after(
        'notify::title', this._checkWindowRules.bind(this));
    }
    this._checkWindowRules(window);
  }

  _onWindowRemoved(workspace, window)
  {
    if (window._notifyWindowRulesId) {
      window.disconnect(window._notifyWindowRulesId);
      window._notifyWindowRulesId = null;
    }
    if (window._hasWindowRules)
      window._hasWindowRules = null;
  }

  _checkWindowRules(window)
  {
    const rules = this.settings.get_value('window-rules').deep_unpack();
    
    if (rules.length === 0) {
      // No rules configured, remove any existing window rules
      if (window._hasWindowRules) {
        if (window.above)
          window.unmake_above();
        if (window.on_all_workspaces)
          window.unstick();
        window._hasWindowRules = null;
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
        log(`Window Rules: Invalid regex pattern "${pattern}": ${e.message}`);
        continue;
      }
    }

    if (matchedRule) {
      window._hasWindowRules = true;

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
    } else {
      // No matching rule, remove any existing window rules
      if (window._hasWindowRules) {
        if (window.above)
          window.unmake_above();
        if (window.on_all_workspaces)
          window.unstick();
        window._hasWindowRules = null;
      }
    }
  }
}

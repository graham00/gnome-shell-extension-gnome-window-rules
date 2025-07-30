import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WindowRulesPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        this.settings = settings;

        // Clean up settings when preferences window is closed
        window.connect('close-request', () => {
            this.settings = null;
        });

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'Window Rules',
            description: 'Configure window rules to automatically apply behaviors based on window title or class',
        });

        // Add rules list
        this.rulesList = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
        });
        
        const rulesRow = new Adw.ActionRow();
        rulesRow.add_suffix(this.rulesList);
        group.add(rulesRow);

        // Add button
        const buttonRow = new Adw.ActionRow({
            title: 'Add New Rule',
        });

        this.addButton = new Gtk.Button({
            label: 'Add Rule',
            icon_name: 'list-add-symbolic',
        });
        this.addButton.connect('clicked', this._addRule.bind(this));
        buttonRow.add_suffix(this.addButton);
        group.add(buttonRow);

        page.add(group);
        window.add(page);

        this.ruleWidgets = [];
        this._loadRules();
    }

    _createRuleWidget(ruleData, index) {
        const frame = new Gtk.Frame({
            label: `Window Rule ${index + 1}`,
            margin_top: 6,
            margin_bottom: 6,
        });

        // Add a remove button to the frame label area
        const removeButton = new Gtk.Button({
            icon_name: 'window-close-symbolic',
            tooltip_text: 'Remove this rule',
            css_classes: ['flat', 'circular'],
        });
        removeButton.connect('clicked', () => {
            this._removeRuleAt(index);
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });

        // Pattern entry
        const patternBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
        });
        const patternLabel = new Gtk.Label({
            label: 'Pattern (Regex):',
            xalign: 0,
        });
        const patternEntry = new Gtk.Entry({
            text: ruleData.pattern || '',
            placeholder_text: 'Enter regex pattern...',
            hexpand: true,
        });
        patternBox.append(patternLabel);
        patternBox.append(patternEntry);
        box.append(patternBox);

        // Type selector
        const typeBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
        });
        const typeLabel = new Gtk.Label({
            label: 'Match Type:',
            xalign: 0,
        });
        const typeCombo = new Gtk.ComboBoxText();
        typeCombo.append('title', 'Window Title');
        typeCombo.append('class', 'Window Class');
        typeCombo.set_active_id(ruleData.type || 'title');
        typeBox.append(typeLabel);
        typeBox.append(typeCombo);
        box.append(typeBox);

        // Behavior toggles
        const behaviorBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
        });
        
        const behaviorLabel = new Gtk.Label({
            label: 'Behavior:',
            xalign: 0,
        });
        behaviorBox.append(behaviorLabel);

        const stickyToggle = new Gtk.CheckButton({
            label: 'Sticky (Show on all workspaces)',
            active: ruleData.sticky || false,
        });
        behaviorBox.append(stickyToggle);

        const aboveToggle = new Gtk.CheckButton({
            label: 'Always on Top',
            active: ruleData.above || false,
        });
        behaviorBox.append(aboveToggle);

        box.append(behaviorBox);
        
        // Add remove button to the top right of the frame
        const headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
        });
        headerBox.append(new Gtk.Label({ hexpand: true })); // Spacer
        headerBox.append(removeButton);
        
        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
        });
        mainBox.append(headerBox);
        mainBox.append(box);
        
        frame.set_child(mainBox);

        // Connect signals
        const updateRule = () => {
            const rule = {
                pattern: patternEntry.get_text(),
                type: typeCombo.get_active_id(),
                sticky: stickyToggle.get_active(),
                above: aboveToggle.get_active()
            };
            this._updateRule(index, rule);
            this._updateFrameLabel(frame, rule, index);
        };

        patternEntry.connect('changed', updateRule);
        typeCombo.connect('changed', updateRule);
        stickyToggle.connect('toggled', updateRule);
        aboveToggle.connect('toggled', updateRule);

        // Initial label update
        this._updateFrameLabel(frame, ruleData, index);

        return frame;
    }

    _updateFrameLabel(frame, rule, index) {
        const typeText = rule.type === 'title' ? 'Title' : 'Class';
        const behaviors = [];
        if (rule.sticky) behaviors.push('Sticky');
        if (rule.above) behaviors.push('Above');
        
        const behaviorText = behaviors.length > 0 ? behaviors.join(', ') : 'None';
        frame.set_label(`Rule ${index + 1}: ${typeText} "${rule.pattern}" → ${behaviorText}`);
    }

    _updateRule(index, rule) {
        const rules = this.settings.get_value('window-rules').deep_unpack();
        
        const variantRule = {
            'pattern': GLib.Variant.new_string(rule.pattern),
            'type': GLib.Variant.new_string(rule.type),
            'sticky': GLib.Variant.new_boolean(rule.sticky),
            'above': GLib.Variant.new_boolean(rule.above)
        };
        rules[index] = variantRule;
        
        this.settings.set_value('window-rules', new GLib.Variant('aa{sv}', rules));
    }

    _loadRules() {
        const rules = this.settings.get_value('window-rules').deep_unpack();
        
        // Clear existing widgets
        for (let widget of this.ruleWidgets) {
            this.rulesList.remove(widget);
        }
        this.ruleWidgets = [];
        
        for (let i = 0; i < rules.length; i++) {
            const ruleData = rules[i] ? {
                pattern: rules[i].pattern ? rules[i].pattern.unpack() : '',
                type: rules[i].type ? rules[i].type.unpack() : 'title',
                sticky: rules[i].sticky ? rules[i].sticky.unpack() : false,
                above: rules[i].above ? rules[i].above.unpack() : false
            } : {
                pattern: '',
                type: 'title',
                sticky: false,
                above: false
            };
            
            const ruleWidget = this._createRuleWidget(ruleData, i);
            this.rulesList.append(ruleWidget);
            this.ruleWidgets.push(ruleWidget);
        }
    }

    _addRule() {
        const rules = this.settings.get_value('window-rules').deep_unpack();
        const newRule = {
            'pattern': GLib.Variant.new_string(''),
            'type': GLib.Variant.new_string('title'),
            'sticky': GLib.Variant.new_boolean(false),
            'above': GLib.Variant.new_boolean(false)
        };
        rules.push(newRule);
        this.settings.set_value('window-rules', new GLib.Variant('aa{sv}', rules));
        
        this._loadRules();
    }

    _removeRuleAt(index) {
        const rules = this.settings.get_value('window-rules').deep_unpack();
        if (index >= 0 && index < rules.length) {
            rules.splice(index, 1);
            this.settings.set_value('window-rules', new GLib.Variant('aa{sv}', rules));
            
            this._loadRules();
        }
    }

    _removeRule() {
        const rules = this.settings.get_value('window-rules').deep_unpack();
        if (rules.length > 0) {
            rules.pop();
            this.settings.set_value('window-rules', new GLib.Variant('aa{sv}', rules));
            
            this._loadRules();
        }
    }
}

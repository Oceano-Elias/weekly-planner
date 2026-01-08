/**
 * DepartmentSettings Component
 * Allows users to add, rename, delete, and recolor departments
 */

import { Store } from '../store.js';
import { DepartmentData, refreshDepartments } from '../departments.js';

export const DepartmentSettings = {
    isOpen: false,
    editingData: null,

    /**
     * Open the settings modal
     */
    open() {
        this.isOpen = true;
        // Clone current department data for editing
        this.editingData = JSON.parse(JSON.stringify(DepartmentData));
        this.render();
    },

    /**
     * Close the settings modal
     */
    close() {
        this.isOpen = false;
        const modal = document.getElementById('departmentSettingsModal');
        if (modal) modal.remove();
    },

    /**
     * Save changes and close
     */
    save() {
        Store.saveCustomDepartments(this.editingData);
        refreshDepartments();
        this.close();
        // Refresh the app to reflect changes
        if (window.Calendar) window.Calendar.renderGrid();
        if (window.Filters) window.Filters.refresh();
    },

    /**
     * Render the settings modal
     */
    render() {
        // Remove existing modal
        const existing = document.getElementById('departmentSettingsModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'departmentSettingsModal';
        modal.className = 'dept-settings-modal';
        modal.innerHTML = `
            <div class="dept-settings-overlay" onclick="window.DepartmentSettings.close()"></div>
            <div class="dept-settings-content">
                <div class="dept-settings-header">
                    <h2>⚙️ Department Settings</h2>
                    <button class="dept-settings-close" onclick="window.DepartmentSettings.close()">×</button>
                </div>
                <div class="dept-settings-body" id="deptSettingsTree">
                    ${this.renderTree()}
                </div>
                <div class="dept-settings-footer">
                    <button class="btn btn-secondary" onclick="window.DepartmentSettings.addDepartment()">
                        + Add Department
                    </button>
                    <div class="dept-settings-actions">
                        <button class="btn btn-ghost" onclick="window.DepartmentSettings.close()">Cancel</button>
                        <button class="btn btn-primary" onclick="window.DepartmentSettings.save()">Save Changes</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    /**
     * Render the department tree
     */
    renderTree() {
        let html = '';

        for (const [name, data] of Object.entries(this.editingData)) {
            html += this.renderDepartmentNode(name, data, [name], 0);
        }

        return html;
    },

    /**
     * Render a single department node
     */
    renderDepartmentNode(name, data, path, level) {
        const indent = level * 24;
        const isTopLevel = level === 0;
        const pathStr = JSON.stringify(path);

        let html = `
            <div class="dept-node" style="padding-left: ${indent}px" data-path='${pathStr}'>
                <div class="dept-node-content">
                    ${isTopLevel ? `
                        <input type="color" class="dept-color-picker" 
                               value="${data.color || '#666'}" 
                               onchange="window.DepartmentSettings.updateColor(${pathStr}, this.value)"
                               title="Change color">
                    ` : `<span class="dept-indent-line"></span>`}
                    <span class="dept-badge" style="background-color: ${this.getParentColor(path)}">${data.abbr || name[0]}</span>
                    <span class="dept-name">${name}</span>
                    <div class="dept-actions">
                        <button class="dept-action-btn" onclick="window.DepartmentSettings.renameDept(${pathStr})" title="Rename">✏️</button>
                        <button class="dept-action-btn" onclick="window.DepartmentSettings.deleteDept(${pathStr})" title="Delete">🗑️</button>
                        <button class="dept-action-btn" onclick="window.DepartmentSettings.addChild(${pathStr})" title="Add sub-department">+</button>
                    </div>
                </div>
            </div>
        `;

        // Render children
        if (data.children) {
            for (const [childName, childData] of Object.entries(data.children)) {
                html += this.renderDepartmentNode(childName, childData, [...path, childName], level + 1);
            }
        }

        return html;
    },

    /**
     * Get parent color for nested departments
     */
    getParentColor(path) {
        const topLevel = path[0];
        return this.editingData[topLevel]?.color || '#666';
    },

    /**
     * Add a new top-level department
     */
    addDepartment() {
        const name = prompt('Enter new department name:');
        if (!name || name.trim() === '') return;

        const abbr = prompt('Enter abbreviation (1-3 letters):', name.substring(0, 2).toUpperCase());
        if (!abbr) return;

        this.editingData[name.toUpperCase()] = {
            color: '#6366F1',
            abbr: abbr.toUpperCase().substring(0, 3),
            children: {}
        };

        this.updateTreeView();
    },

    /**
     * Add a child department
     */
    addChild(path) {
        const name = prompt('Enter sub-department name:');
        if (!name || name.trim() === '') return;

        const abbr = prompt('Enter abbreviation (1-3 letters):', name.substring(0, 2).toUpperCase());
        if (!abbr) return;

        let target = this.editingData;
        for (let i = 0; i < path.length; i++) {
            if (i === 0) {
                target = target[path[i]];
            } else {
                target = target.children[path[i]];
            }
        }

        if (!target.children) target.children = {};
        target.children[name] = {
            abbr: abbr.toUpperCase().substring(0, 3),
            children: {}
        };

        this.updateTreeView();
    },

    /**
     * Rename a department
     */
    renameDept(path) {
        const currentName = path[path.length - 1];
        const newName = prompt('Enter new name:', currentName);
        if (!newName || newName.trim() === '' || newName === currentName) return;

        const newAbbr = prompt('Enter new abbreviation:', newName.substring(0, 2).toUpperCase());
        if (!newAbbr) return;

        // Get parent and rename
        if (path.length === 1) {
            // Top level
            const data = this.editingData[currentName];
            delete this.editingData[currentName];
            this.editingData[newName.toUpperCase()] = { ...data, abbr: newAbbr.toUpperCase().substring(0, 3) };
        } else {
            // Nested
            let parent = this.editingData;
            for (let i = 0; i < path.length - 1; i++) {
                if (i === 0) {
                    parent = parent[path[i]];
                } else {
                    parent = parent.children[path[i]];
                }
            }
            const data = parent.children[currentName];
            delete parent.children[currentName];
            parent.children[newName] = { ...data, abbr: newAbbr.toUpperCase().substring(0, 3) };
        }

        this.updateTreeView();
    },

    /**
     * Delete a department
     */
    deleteDept(path) {
        const name = path[path.length - 1];
        if (!confirm(`Delete "${name}" and all its sub-departments?`)) return;

        if (path.length === 1) {
            delete this.editingData[path[0]];
        } else {
            let parent = this.editingData;
            for (let i = 0; i < path.length - 1; i++) {
                if (i === 0) {
                    parent = parent[path[i]];
                } else {
                    parent = parent.children[path[i]];
                }
            }
            delete parent.children[path[path.length - 1]];
        }

        this.updateTreeView();
    },

    /**
     * Update color for a top-level department
     */
    updateColor(path, color) {
        if (path.length === 1) {
            this.editingData[path[0]].color = color;
            this.updateTreeView();
        }
    },

    /**
     * Update the tree view
     */
    updateTreeView() {
        const container = document.getElementById('deptSettingsTree');
        if (container) {
            container.innerHTML = this.renderTree();
        }
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.DepartmentSettings = DepartmentSettings;
}

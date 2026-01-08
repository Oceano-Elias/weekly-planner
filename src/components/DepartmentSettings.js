/**
 * DepartmentSettings Component
 * Allows users to add, rename, delete, and recolor departments
 */

import { Store } from '../store.js';
import { DepartmentData, refreshDepartments } from '../departments.js';

export const DepartmentSettings = {
    isOpen: false,
    editingData: null,
    migrationsPending: [],

    /**
     * Open the settings modal
     */
    open() {
        this.isOpen = true;
        // Clone current department data for editing
        this.editingData = JSON.parse(JSON.stringify(DepartmentData));
        this.migrationsPending = [];
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
        // Apply migrations first
        this.migrationsPending.forEach(migration => {
            Store.migrateDepartment(migration.oldPath, migration.newPath);
        });

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
                    <h2>Department Settings</h2>
                    <button class="dept-settings-close" onclick="window.DepartmentSettings.close()">×</button>
                </div>
                <div class="dept-settings-body" id="deptSettingsTree">
                    ${this.renderTree()}
                </div>
                <div class="dept-settings-footer">
                    <button class="btn btn-secondary" onclick="window.DepartmentSettings.addDepartment()">
                        ＋ Add Department
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
     * Render the department tree with collapsible sections
     */
    renderTree() {
        let html = '';
        const entries = Object.entries(this.editingData);

        if (entries.length === 0) {
            return '<div class="dept-empty-state"><p>No departments yet. Click "+ Add Department" to create one.</p></div>';
        }

        for (const [name, data] of entries) {
            html += this.renderParentSection(name, data, [name]);
        }

        return html;
    },

    /**
     * Render a parent department section (collapsible)
     */
    renderParentSection(name, data, path) {
        const pathStr = JSON.stringify(path);
        const hasChildren = data.children && Object.keys(data.children).length > 0;
        const childCount = hasChildren ? Object.keys(data.children).length : 0;

        let childrenHtml = '';
        if (hasChildren) {
            childrenHtml = '<div class="dept-children">';
            for (const [childName, childData] of Object.entries(data.children)) {
                childrenHtml += this.renderChildNode(childName, childData, [...path, childName]);
            }
            childrenHtml += '</div>';
        }

        return `
            <div class="dept-section" data-path='${pathStr}'>
                <div class="dept-parent">
                    <input type="color" class="dept-color-picker" 
                           value="${data.color || '#6366F1'}" 
                           onchange="window.DepartmentSettings.updateColor(${pathStr}, this.value)"
                           title="Click to change color">
                    <span class="dept-badge" style="background: ${data.color || '#6366F1'}">${data.abbr || name.substring(0, 2)}</span>
                    <span class="dept-name">${name}</span>
                    ${childCount > 0 ? `<span class="dept-child-count">${childCount}</span>` : ''}
                    <div class="dept-actions">
                        <button class="dept-action-btn" onclick="window.DepartmentSettings.renameDept(${pathStr})" title="Rename">✏</button>
                        <button class="dept-action-btn add" onclick="window.DepartmentSettings.addChild(${pathStr})" title="Add sub-department">＋</button>
                        <button class="dept-action-btn delete" onclick="window.DepartmentSettings.deleteDept(${pathStr})" title="Delete">✕</button>
                    </div>
                </div>
                ${childrenHtml}
            </div>
        `;
    },

    /**
     * Render a child department node
     */
    renderChildNode(name, data, path) {
        const pathStr = JSON.stringify(path);
        const parentColor = this.getParentColor(path);
        const hasSubChildren = data.children && Object.keys(data.children).length > 0;

        let subChildrenHtml = '';
        if (hasSubChildren) {
            subChildrenHtml = '<div class="dept-subchildren">';
            for (const [subName, subData] of Object.entries(data.children)) {
                subChildrenHtml += this.renderSubChildNode(subName, subData, [...path, subName]);
            }
            subChildrenHtml += '</div>';
        }

        return `
            <div class="dept-child" data-path='${pathStr}'>
                <div class="dept-child-content">
                    <span class="dept-connector"></span>
                    <span class="dept-badge small" style="background: ${parentColor}">${data.abbr || name.substring(0, 2)}</span>
                    <span class="dept-name">${name}</span>
                    <div class="dept-actions">
                        <button class="dept-action-btn" onclick="window.DepartmentSettings.renameDept(${pathStr})" title="Rename">✏</button>
                        <button class="dept-action-btn add" onclick="window.DepartmentSettings.addChild(${pathStr})" title="Add">＋</button>
                        <button class="dept-action-btn delete" onclick="window.DepartmentSettings.deleteDept(${pathStr})" title="Delete">✕</button>
                    </div>
                </div>
                ${subChildrenHtml}
            </div>
        `;
    },

    /**
     * Render a sub-child (level 3+) department node
     */
    renderSubChildNode(name, data, path) {
        const pathStr = JSON.stringify(path);
        const parentColor = this.getParentColor(path);

        return `
            <div class="dept-subchild" data-path='${pathStr}'>
                <span class="dept-connector deep"></span>
                <span class="dept-badge tiny" style="background: ${parentColor}">${data.abbr || name.substring(0, 2)}</span>
                <span class="dept-name">${name}</span>
                <div class="dept-actions">
                    <button class="dept-action-btn" onclick="window.DepartmentSettings.renameDept(${pathStr})" title="Rename">✏</button>
                    <button class="dept-action-btn delete" onclick="window.DepartmentSettings.deleteDept(${pathStr})" title="Delete">✕</button>
                </div>
            </div>
        `;
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
            const newUpper = newName.toUpperCase();
            delete this.editingData[currentName];
            this.editingData[newUpper] = { ...data, abbr: newAbbr.toUpperCase().substring(0, 3) };

            // Record migration
            this.migrationsPending.push({
                oldPath: path,
                newPath: [newUpper]
            });
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

            // Record migration
            this.migrationsPending.push({
                oldPath: path,
                newPath: [...path.slice(0, -1), newName]
            });
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
            // Record deletion migration
            this.migrationsPending.push({
                oldPath: path,
                newPath: null
            });
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

            // Record deletion migration
            this.migrationsPending.push({
                oldPath: path,
                newPath: null
            });
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

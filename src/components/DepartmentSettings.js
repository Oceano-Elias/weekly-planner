/**
 * DepartmentSettings Component
 * Allows users to add, rename, delete, and recolor departments
 */

import { Store } from '../store.js';
import { DepartmentData, refreshDepartments } from '../departments.js';
import FocusTrap from '../utils/FocusTrap.js';

export const DepartmentSettings = {
    isOpen: false,
    editingData: null,
    migrationsPending: [],

    // Drag and drop state
    draggedDept: null,
    dragOverDept: null,

    /**
     * Open the settings modal
     */
    open() {
        this.isOpen = true;
        // Clone current department data for editing
        this.editingData = JSON.parse(JSON.stringify(DepartmentData));
        this.migrationsPending = [];
        this.render();
        // Activate focus trap for accessibility
        const modal = document.getElementById('departmentSettingsModal');
        if (modal) FocusTrap.activate(modal);
    },

    /**
     * Close the settings modal
     */
    close() {
        this.isOpen = false;
        // Remove Escape key handler
        if (this._escapeHandler) {
            document.removeEventListener('keydown', this._escapeHandler);
            this._escapeHandler = null;
        }
        // Deactivate focus trap and restore focus
        FocusTrap.deactivate();
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

        // Handle Escape key to close modal
        this._escapeHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        };
        document.addEventListener('keydown', this._escapeHandler);
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
        const isDragOver = this.dragOverDept === name;

        let childrenHtml = '';
        if (hasChildren) {
            childrenHtml = '<div class="dept-children">';
            for (const [childName, childData] of Object.entries(data.children)) {
                childrenHtml += this.renderChildNode(childName, childData, [...path, childName]);
            }
            childrenHtml += '</div>';
        }

        return `
            <div class="dept-section ${isDragOver ? 'drag-over' : ''}" 
                 data-path='${pathStr}'
                 data-dept-name="${name}"
                 draggable="true"
                 ondragstart="window.DepartmentSettings.handleDragStart(event, '${name}')"
                 ondragend="window.DepartmentSettings.handleDragEnd(event)"
                 ondragover="window.DepartmentSettings.handleDragOver(event, '${name}')"
                 ondragleave="window.DepartmentSettings.handleDragLeave(event)"
                 ondrop="window.DepartmentSettings.handleDrop(event, '${name}')">
                <div class="dept-parent">
                    <span class="dept-drag-handle" title="Drag to reorder">⋮⋮</span>
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

        // Count children recursively
        const countChildren = (data) => {
            if (!data || !data.children) return 0;
            let count = Object.keys(data.children).length;
            for (const child of Object.values(data.children)) {
                count += countChildren(child);
            }
            return count;
        };

        // Get the target node
        let target;
        if (path.length === 1) {
            target = this.editingData[path[0]];
        } else {
            target = this.editingData;
            for (let i = 0; i < path.length; i++) {
                if (i === 0) {
                    target = target[path[i]];
                } else {
                    target = target.children[path[i]];
                }
            }
        }

        const childCount = countChildren(target);
        let message = `Delete "${name}"?`;
        if (childCount > 0) {
            message = `Delete "${name}" and ${childCount} sub-department${childCount > 1 ? 's' : ''}?`;
        }

        if (!confirm(message)) return;

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
    },

    // ========================================
    // DRAG AND DROP HANDLERS
    // ========================================

    /**
     * Handle drag start
     */
    handleDragStart(event, deptName) {
        this.draggedDept = deptName;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', deptName);

        // Add dragging class for visual feedback
        setTimeout(() => {
            const el = event.target.closest('.dept-section');
            if (el) el.classList.add('dragging');
        }, 0);
    },

    /**
     * Handle drag end
     */
    handleDragEnd(event) {
        this.draggedDept = null;
        this.dragOverDept = null;

        // Remove all drag classes
        document.querySelectorAll('.dept-section').forEach(el => {
            el.classList.remove('dragging', 'drag-over');
        });
    },

    /**
     * Handle drag over
     */
    handleDragOver(event, deptName) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        if (deptName !== this.draggedDept && deptName !== this.dragOverDept) {
            this.dragOverDept = deptName;
            // Update visual feedback
            document.querySelectorAll('.dept-section').forEach(el => {
                el.classList.remove('drag-over');
                if (el.dataset.deptName === deptName) {
                    el.classList.add('drag-over');
                }
            });
        }
    },

    /**
     * Handle drag leave
     */
    handleDragLeave(event) {
        // Only remove if leaving the section entirely
        const relatedTarget = event.relatedTarget;
        if (!relatedTarget || !event.target.contains(relatedTarget)) {
            event.target.classList.remove('drag-over');
        }
    },

    /**
     * Handle drop - reorder departments
     */
    handleDrop(event, targetDeptName) {
        event.preventDefault();

        const sourceDeptName = this.draggedDept;
        if (!sourceDeptName || sourceDeptName === targetDeptName) {
            this.handleDragEnd(event);
            return;
        }

        // Reorder the editingData object
        const entries = Object.entries(this.editingData);
        const sourceIndex = entries.findIndex(([name]) => name === sourceDeptName);
        const targetIndex = entries.findIndex(([name]) => name === targetDeptName);

        if (sourceIndex === -1 || targetIndex === -1) {
            this.handleDragEnd(event);
            return;
        }

        // Remove source and insert at target position
        const [removed] = entries.splice(sourceIndex, 1);
        entries.splice(targetIndex, 0, removed);

        // Rebuild editingData with new order
        this.editingData = Object.fromEntries(entries);

        this.handleDragEnd(event);
        this.updateTreeView();
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.DepartmentSettings = DepartmentSettings;
}

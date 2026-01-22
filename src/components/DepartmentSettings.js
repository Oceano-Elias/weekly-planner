/**
 * DepartmentSettings Component
 * Allows users to add, rename, delete, and recolor departments
 */

import { Store } from '../store.js';
import { DepartmentData, refreshDepartments } from '../departments.js';
import FocusTrap from '../utils/FocusTrap.js';

export const DepartmentSettings = {
    // State management
    isOpen: false,
    editingData: null,
    migrationsPending: [],
    collapsedPaths: new Set(),
    editingPath: null,
    editingField: null,
    draggedPath: null,
    dragOverPath: null,

    // Curated Colors
    curatedColors: [
        '#6366F1', // Indigo
        '#22C55E', // Vivid Green
        '#EAB308', // Gold
        '#D946EF', // Fuchsia
        '#8B5CF6', // Vivid Purple
        '#06B6D4', // Strong Cyan
        '#F97316', // Deep Orange
        '#2563EB', // Bright Blue
        '#64748B', // Cool Slate
        '#DC2626'  // Bright Red
    ],

    /**
     * Set path as being edited
     */
    startEditing(pathStr, field, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        this.editingPath = pathStr;
        this.editingField = field;
        this.updateTreeView();

        // Focus the input
        setTimeout(() => {
            const input = document.querySelector('.dept-inline-input');
            if (input) {
                input.focus();
                input.select();
            }
        }, 0);
    },

    /**
     * Confirm the current edit
     */
    confirmEdit() {
        if (!this.editingPath) return;

        const input = document.querySelector('.dept-inline-input');
        if (!input) {
            this.editingPath = null;
            this.editingField = null;
            return;
        }

        const newValue = input.value.trim();
        const path = JSON.parse(this.editingPath);
        const field = this.editingField;

        // Reset state
        this.editingPath = null;
        this.editingField = null;

        if (newValue === '') {
            this.updateTreeView();
            return;
        }

        if (field === 'name') {
            this.renameDeptInternal(path, newValue);
        } else if (field === 'abbr') {
            this.updateAbbrInternal(path, newValue.toUpperCase());
        }

        this.updateTreeView();
    },

    /**
     * Handle keydown in inline editor
     */
    handleEditKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.confirmEdit();
        } else if (event.key === 'Escape') {
            this.editingPath = null;
            this.editingField = null;
            this.updateTreeView();
        }
    },

    /**
     * Toggle branch collapse
     */
    toggleCollapse(pathStr, event) {
        if (event) {
            event.stopPropagation();
        }
        if (this.collapsedPaths.has(pathStr)) {
            this.collapsedPaths.delete(pathStr);
        } else {
            this.collapsedPaths.add(pathStr);
        }
        this.updateTreeView();
    },

    /**
     * Internal: Rename a department
     */
    renameDeptInternal(path, newName) {
        const currentName = path[path.length - 1];
        if (newName === currentName) return;

        // Suggest abbreviation if renaming
        const newAbbr = this.generateAbbreviation(newName);

        if (path.length === 1) {
            const data = this.editingData[currentName];
            const newKey = newName.toUpperCase();
            delete this.editingData[currentName];
            this.editingData[newKey] = { ...data, abbr: newAbbr };
            this.migrationsPending.push({ oldPath: path, newPath: [newKey] });
        } else {
            let parent = this.editingData;
            for (let i = 0; i < path.length - 1; i++) {
                parent = i === 0 ? parent[path[i]] : parent.children[path[i]];
            }
            const data = parent.children[currentName];
            delete parent.children[currentName];
            parent.children[newName] = { ...data, abbr: newAbbr };
            this.migrationsPending.push({ oldPath: path, newPath: [...path.slice(0, -1), newName] });
        }
    },

    /**
     * Internal: Update abbreviation
     */
    updateAbbrInternal(path, newAbbr) {
        let node = this.editingData;
        for (let i = 0; i < path.length; i++) {
            node = i === 0 ? node[path[i]] : node.children[path[i]];
        }
        node.abbr = newAbbr.substring(0, 3);
    },

    /**
     * Smart Abbreviation Generator
     */
    generateAbbreviation(name) {
        if (!name) return '';
        const words = name.trim().split(/\s+/);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    },


    /**
     * Escape JSON string for use in HTML attributes
     */
    escapePath(pathStr) {
        return pathStr.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /**
     * Open the settings modal
     */
    open() {
        this.isOpen = true;
        this.editingData = JSON.parse(JSON.stringify(DepartmentData));
        this.migrationsPending = [];

        // Collapse all by default
        this.collapsedPaths = new Set();
        this.collapseRecursively(this.editingData, []);

        this.editingPath = null;
        this.editingField = null;

        this.render();
        const modal = document.getElementById('departmentSettingsModal');
        if (modal) FocusTrap.activate(modal);
    },

    /**
     * Helper to collapse everything
     */
    collapseRecursively(data, path) {
        for (const [name, content] of Object.entries(data)) {
            const currentPath = [...path, name];
            const pathStr = JSON.stringify(currentPath);
            if (content.children && Object.keys(content.children).length > 0) {
                this.collapsedPaths.add(pathStr);
                this.collapseRecursively(content.children, currentPath);
            }
        }
    },

    /**
     * Toggle Expand/Collapse All
     */
    toggleExpandAll() {
        const anyCollapsed = this.collapsedPaths.size > 0;
        if (anyCollapsed) {
            this.collapsedPaths = new Set();
        } else {
            this.collapseRecursively(this.editingData, []);
        }
        this.updateTreeView();
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
        this.migrationsPending.forEach((migration) => {
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
                    <div class="dept-header-actions">
                        <button class="btn-icon-text" onclick="window.DepartmentSettings.toggleExpandAll()">
                            ↕ Toggle All
                        </button>
                        <button class="dept-settings-close" onclick="window.DepartmentSettings.close()">×</button>
                    </div>
                </div>
                <div class="dept-settings-body" id="deptSettingsTree">
                    ${this.renderTree()}
                </div>
                <div class="dept-settings-footer">
                    <button class="btn btn-secondary" onclick="window.DepartmentSettings.addDepartment()">
                        ＋ Add Global Category
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
        const isCollapsed = this.collapsedPaths.has(pathStr);
        const isDragOver = this.dragOverPath === pathStr;

        const isEditingName = this.editingPath === pathStr && this.editingField === 'name';
        const isEditingAbbr = this.editingPath === pathStr && this.editingField === 'abbr';

        let childrenHtml = '';
        if (hasChildren && !isCollapsed) {
            childrenHtml = '<div class="dept-children">';
            for (const [childName, childData] of Object.entries(data.children)) {
                childrenHtml += this.renderChildNode(childName, childData, [...path, childName]);
            }
            childrenHtml += '</div>';
        }

        const escPath = this.escapePath(pathStr);

        return `
            <div class="dept-section ${isCollapsed ? 'collapsed' : ''} ${isDragOver ? 'drag-over' : ''}"
                 data-path='${escPath}'
                 draggable="true"
                 ondragstart="window.DepartmentSettings.handleDragStart(event, '${escPath}')"
                 ondragend="window.DepartmentSettings.handleDragEnd(event)"
                 ondragover="window.DepartmentSettings.handleDragOver(event, '${escPath}')"
                 ondragleave="window.DepartmentSettings.handleDragLeave(event)"
                 ondrop="window.DepartmentSettings.handleDrop(event, '${escPath}')">
                <div class="dept-parent">
                    <span class="dept-drag-handle" title="Drag to reorder">⋮⋮</span>
                    <div class="dept-collapse-toggle ${isCollapsed ? 'collapsed' : ''}"
                         onclick="window.DepartmentSettings.toggleCollapse('${escPath}', event)">
                        ${hasChildren ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' : ''}
                    </div>
                    <div class="dept-parent-header">
                        <div class="dept-color-manager">
                            <div class="dept-color-swatch-trigger" style="background: ${data.color || '#6366F1'}" title="Change color"></div>
                            ${this.renderColorPicker(path, data.color || '#6366F1')}
                        </div>
                        <span class="dept-badge" 
                              style="background: ${data.color || '#6366F1'}"
                              ondblclick="window.DepartmentSettings.startEditing('${escPath}', 'abbr', event)">
                            ${isEditingAbbr ? `<input type="text" class="dept-inline-input" value="${data.abbr || ''}" maxlength="3" onblur="window.DepartmentSettings.confirmEdit()" onkeydown="window.DepartmentSettings.handleEditKeydown(event)">` : (data.abbr || name.substring(0, 2))}
                        </span>
                        <span class="dept-name" ondblclick="window.DepartmentSettings.startEditing('${escPath}', 'name', event)">
                            ${isEditingName ? `<input type="text" class="dept-inline-input" value="${name}" onblur="window.DepartmentSettings.confirmEdit()" onkeydown="window.DepartmentSettings.handleEditKeydown(event)">` : name}
                        </span>
                        ${childCount > 0 ? `<span class="dept-child-count">${childCount}</span>` : ''}
                    </div>
                    <div class="dept-actions">
                        <button class="dept-action-btn" onclick="window.DepartmentSettings.renameDept('${escPath}')" title="Rename">✏</button>
                        <button class="dept-action-btn add" onclick="window.DepartmentSettings.addChild('${escPath}')" title="Add sub-department">＋</button>
                        <button class="dept-action-btn delete" onclick="window.DepartmentSettings.deleteDept('${escPath}')" title="Delete">✕</button>
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
        const isCollapsed = this.collapsedPaths.has(pathStr);
        const isDragOver = this.dragOverPath === pathStr;

        const isEditingName = this.editingPath === pathStr && this.editingField === 'name';
        const isEditingAbbr = this.editingPath === pathStr && this.editingField === 'abbr';

        let subChildrenHtml = '';
        if (hasSubChildren && !isCollapsed) {
            subChildrenHtml = '<div class="dept-subchildren">';
            for (const [subName, subData] of Object.entries(data.children)) {
                subChildrenHtml += this.renderSubChildNode(subName, subData, [...path, subName]);
            }
            subChildrenHtml += '</div>';
        }

        const escPath = this.escapePath(pathStr);

        return `
            <div class="dept-child ${isDragOver ? 'drag-over' : ''}"
                 data-path='${escPath}'
                 draggable="true"
                 ondragstart="window.DepartmentSettings.handleDragStart(event, '${escPath}')"
                 ondragend="window.DepartmentSettings.handleDragEnd(event)"
                 ondragover="window.DepartmentSettings.handleDragOver(event, '${escPath}')"
                 ondragleave="window.DepartmentSettings.handleDragLeave(event)"
                 ondrop="window.DepartmentSettings.handleDrop(event, '${escPath}')">
                <div class="dept-child-content">
                    <span class="dept-connector" onclick="window.DepartmentSettings.toggleCollapse('${escPath}', event)">
                        ${hasSubChildren ? (isCollapsed ? '+' : '-') : ''}
                    </span>
                    <span class="dept-badge small"
                          style="background: ${parentColor}"
                          ondblclick="window.DepartmentSettings.startEditing('${escPath}', 'abbr', event)">
                        ${isEditingAbbr ? `<input type="text" class="dept-inline-input" value="${data.abbr || ''}" maxlength="3" onblur="window.DepartmentSettings.confirmEdit()" onkeydown="window.DepartmentSettings.handleEditKeydown(event)">` : (data.abbr || name.substring(0, 2))}
                    </span>
                    <span class="dept-name" ondblclick="window.DepartmentSettings.startEditing('${escPath}', 'name', event)">
                        ${isEditingName ? `<input type="text" class="dept-inline-input" value="${name}" onblur="window.DepartmentSettings.confirmEdit()" onkeydown="window.DepartmentSettings.handleEditKeydown(event)">` : name}
                    </span>
                    <div class="dept-actions">
                        <button class="dept-action-btn" onclick="window.DepartmentSettings.renameDept('${escPath}')" title="Rename">✏</button>
                        <button class="dept-action-btn add" onclick="window.DepartmentSettings.addChild('${escPath}')" title="Add">＋</button>
                        <button class="dept-action-btn delete" onclick="window.DepartmentSettings.deleteDept('${escPath}')" title="Delete">✕</button>
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
        const isDragOver = this.dragOverPath === pathStr;

        const isEditingName = this.editingPath === pathStr && this.editingField === 'name';
        const isEditingAbbr = this.editingPath === pathStr && this.editingField === 'abbr';

        const escPath = this.escapePath(pathStr);

        return `
            <div class="dept-subchild ${isDragOver ? 'drag-over' : ''}"
                 data-path='${escPath}'
                 draggable="true"
                 ondragstart="window.DepartmentSettings.handleDragStart(event, '${escPath}')"
                 ondragend="window.DepartmentSettings.handleDragEnd(event)"
                 ondragover="window.DepartmentSettings.handleDragOver(event, '${escPath}')"
                 ondragleave="window.DepartmentSettings.handleDragLeave(event)"
                 ondrop="window.DepartmentSettings.handleDrop(event, '${escPath}')">
                <span class="dept-connector deep"></span>
                <span class="dept-badge tiny"
                      style="background: ${parentColor}"
                      ondblclick="window.DepartmentSettings.startEditing('${escPath}', 'abbr', event)">
                    ${isEditingAbbr ? `<input type="text" class="dept-inline-input" value="${data.abbr || ''}" maxlength="3" onblur="window.DepartmentSettings.confirmEdit()" onkeydown="window.DepartmentSettings.handleEditKeydown(event)">` : (data.abbr || name.substring(0, 2))}
                </span>
                <span class="dept-name" ondblclick="window.DepartmentSettings.startEditing('${escPath}', 'name', event)">
                    ${isEditingName ? `<input type="text" class="dept-inline-input" value="${name}" onblur="window.DepartmentSettings.confirmEdit()" onkeydown="window.DepartmentSettings.handleEditKeydown(event)">` : name}
                </span>
                <div class="dept-actions">
                    <button class="dept-action-btn" onclick="window.DepartmentSettings.renameDept('${escPath}')" title="Rename">✏</button>
                    <button class="dept-action-btn delete" onclick="window.DepartmentSettings.deleteDept('${escPath}')" title="Delete">✕</button>
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
     * Add a new top-level department (Inline)
     */
    addDepartment() {
        const tempName = "NEW DEPARTMENT";
        this.editingData[tempName] = {
            color: '#6366F1',
            abbr: 'NEW',
            children: {},
        };

        this.updateTreeView();
        // Trigger editing for the name immediately
        this.startEditing(JSON.stringify([tempName]), 'name');
    },

    /**
     * Add a child department (Inline)
     */
    addChild(pathStr) {
        const path = JSON.parse(pathStr);
        const tempName = "New Sub-dept";

        let target = this.editingData;
        for (let i = 0; i < path.length; i++) {
            target = i === 0 ? target[path[i]] : target.children[path[i]];
        }

        if (!target.children) target.children = {};
        target.children[tempName] = {
            abbr: 'NEW',
            children: {},
        };

        this.updateTreeView();
        // Expand the parent if it was collapsed
        this.collapsedPaths.delete(pathStr);
        this.updateTreeView();

        // Trigger editing for the name
        this.startEditing(JSON.stringify([...path, tempName]), 'name');
    },

    /**
     * Rename a department (Trigger Inline)
     */
    renameDept(pathOrStr) {
        const path = typeof pathOrStr === 'string' ? JSON.parse(pathOrStr) : pathOrStr;
        this.startEditing(JSON.stringify(path), 'name');
    },

    /**
     * Delete a department
     */
    deleteDept(pathOrStr) {
        const path = typeof pathOrStr === 'string' ? JSON.parse(pathOrStr) : pathOrStr;
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
                newPath: null,
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
                newPath: null,
            });
        }

        this.updateTreeView();
    },

    /**
     * Render a curated color palette
     */
    renderColorPicker(pathOrStr, currentColor) {
        const escPath = typeof pathOrStr === 'string' ? pathOrStr : this.escapePath(JSON.stringify(pathOrStr));
        let html = '<div class="dept-swatch-grid">';

        this.curatedColors.forEach(color => {
            const isSelected = color.toUpperCase() === currentColor.toUpperCase();
            html += `
                <div class="dept-swatch ${isSelected ? 'active' : ''}" 
                     style="background: ${color}" 
                     onclick="window.DepartmentSettings.selectColor('${escPath}', '${color}')"
                     title="${color}">
                </div>
            `;
        });

        html += '</div>';
        return html;
    },

    /**
     * Handle color selection
     */
    selectColor(pathStr, color) {
        const path = JSON.parse(pathStr.replace(/&quot;/g, '"'));
        this.updateColor(path, color);
    },

    /**
     * Update color for a top-level department
     */
    updateColor(pathOrStr, color) {
        const path = typeof pathOrStr === 'string' ? JSON.parse(pathOrStr.replace(/&quot;/g, '"')) : pathOrStr;
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
    // DRAG AND DROP HANDLERS (PATH-BASED REPARENTING)
    // ========================================

    /**
     * Handle drag start
     */
    handleDragStart(event, pathStr) {
        this.draggedPath = pathStr.replace(/&quot;/g, '"');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', this.draggedPath);

        const el = event.target.closest('[draggable="true"]');
        if (el) {
            // Use the "header" part of the card for the drag image 
            // to avoid dragging children together in the ghost image
            const dragImage = el.querySelector('.dept-parent') ||
                el.querySelector('.dept-child-content') ||
                el;

            // Offset the drag image so the cursor is over the handle/icon
            if (event.dataTransfer.setDragImage) {
                event.dataTransfer.setDragImage(dragImage, 20, 20);
            }

            setTimeout(() => {
                el.classList.add('dragging');
            }, 0);
        }
    },

    /**
     * Handle drag end
     */
    handleDragEnd(event) {
        this.draggedPath = null;
        this.dragOverPath = null;

        // Remove all drag classes
        document.querySelectorAll('[draggable="true"]').forEach((el) => {
            el.classList.remove('dragging', 'drag-over');
        });
    },

    /**
     * Handle drag over
     */
    handleDragOver(event, targetPathStr) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        const rawTargetPath = targetPathStr.replace(/&quot;/g, '"');

        // Optimize: Avoid querying if we are already over this path
        if (rawTargetPath !== this.dragOverPath) {
            this.dragOverPath = rawTargetPath;

            // Direct DOM manipulation for performance
            const allDraggables = document.querySelectorAll('[draggable="true"]');
            allDraggables.forEach((el) => {
                if (el.dataset.path === targetPathStr) {
                    el.classList.add('drag-over');
                } else {
                    el.classList.remove('drag-over');
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
        const target = event.target.closest('[draggable="true"]');
        if (target && (!relatedTarget || !target.contains(relatedTarget))) {
            target.classList.remove('drag-over');
        }
    },

    /**
     * Handle drop - Reparent or Reorder
     */
    handleDrop(event, targetPathStr) {
        event.preventDefault();

        const sourcePathStr = this.draggedPath;
        const targetPathStrRaw = targetPathStr.replace(/&quot;/g, '"');

        if (!sourcePathStr || sourcePathStr === targetPathStrRaw) {
            this.handleDragEnd(event);
            return;
        }

        const sourcePath = JSON.parse(sourcePathStr);
        const targetPath = JSON.parse(targetPathStrRaw);

        // 1. Get source data and parent
        let sourceParent = this.editingData;
        const sourceName = sourcePath[sourcePath.length - 1];
        if (sourcePath.length > 1) {
            for (let i = 0; i < sourcePath.length - 1; i++) {
                sourceParent = i === 0 ? sourceParent[sourcePath[i]] : sourceParent.children[sourcePath[i]];
            }
        }
        const branchData = sourcePath.length === 1 ? sourceParent[sourceName] : sourceParent.children[sourceName];

        // 2. Identify Move Type (Reorder vs Reparent)
        const sourceParentPath = sourcePath.slice(0, -1);
        const targetParentPath = targetPath.slice(0, -1);
        const isReorder = JSON.stringify(sourceParentPath) === JSON.stringify(targetParentPath);

        // 3. Perform Move
        if (isReorder) {
            // REORDER: Swap siblings
            let parentData = (sourcePath.length === 1) ? this.editingData : sourceParent.children;
            const entries = Object.entries(parentData);
            const sourceIdx = entries.findIndex(([n]) => n === sourceName);
            const targetIdx = entries.findIndex(([n]) => n === targetPath[targetPath.length - 1]);

            if (sourceIdx !== -1 && targetIdx !== -1) {
                const [removed] = entries.splice(sourceIdx, 1);
                entries.splice(targetIdx, 0, removed);

                if (sourcePath.length === 1) {
                    this.editingData = Object.fromEntries(entries);
                } else {
                    sourceParent.children = Object.fromEntries(entries);
                }
            }
        } else {
            // REPARENT: Move into target's children
            // Prevent recursive nesting
            if (targetPathStrRaw.startsWith(sourcePathStr.slice(0, -1))) {
                this.handleDragEnd(event);
                return;
            }

            // Remove from source
            if (sourcePath.length === 1) {
                delete this.editingData[sourceName];
            } else {
                delete sourceParent.children[sourceName];
            }

            // Add to target node
            let targetNode = this.editingData;
            for (let i = 0; i < targetPath.length; i++) {
                targetNode = i === 0 ? targetNode[targetPath[i]] : targetNode.children[targetPath[i]];
            }
            if (!targetNode.children) targetNode.children = {};
            targetNode.children[sourceName] = branchData;

            this.migrationsPending.push({
                oldPath: sourcePath,
                newPath: [...targetPath, sourceName]
            });
        }

        this.handleDragEnd(event);
        this.updateTreeView();
    },

};

// Make globally available
if (typeof window !== 'undefined') {
    window.DepartmentSettings = DepartmentSettings;
}

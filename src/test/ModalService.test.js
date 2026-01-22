import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModalService } from '../services/ModalService.js';
import FocusTrap from '../utils/FocusTrap.js';

// Mock FocusTrap
vi.mock('../utils/FocusTrap.js', () => ({
    default: {
        activate: vi.fn(),
        deactivate: vi.fn(),
    },
}));

describe('ModalService', () => {
    let modal;
    let openBtn;
    let closeBtn;
    let cancelBtn;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = `
            <div id="taskModal" class="modal"></div>
            <button id="newTaskBtn">New Task</button>
            <button id="closeModal">Close</button>
            <button id="cancelTask">Cancel</button>
        `;

        modal = document.getElementById('taskModal');
        openBtn = document.getElementById('newTaskBtn');
        closeBtn = document.getElementById('closeModal');
        cancelBtn = document.getElementById('cancelTask');

        // Reset mocks
        vi.clearAllMocks();

        // Initialize service
        ModalService.init();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should initialize correctly', () => {
        expect(ModalService.modal).toBe(modal);
        expect(modal.getAttribute('role')).toBe('dialog');
        expect(modal.getAttribute('aria-modal')).toBe('true');
    });

    it('should open modal when open button is clicked', () => {
        const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

        openBtn.click();

        expect(modal.classList.contains('active')).toBe(true);
        expect(FocusTrap.activate).toHaveBeenCalledWith(modal);
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'modal:open' }));
    });

    it('should close modal when close button is clicked', () => {
        // Open first
        ModalService.open();
        expect(modal.classList.contains('active')).toBe(true);

        const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

        closeBtn.click();

        expect(modal.classList.contains('active')).toBe(false);
        expect(FocusTrap.deactivate).toHaveBeenCalled();
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'modal:close' }));
    });

    it('should close modal when cancel button is clicked', () => {
        ModalService.open();
        cancelBtn.click();
        expect(modal.classList.contains('active')).toBe(false);
    });

    it('should close modal when clicking on backdrop', () => {
        ModalService.open();

        // Click on modal itself (backdrop)
        modal.click();
        expect(modal.classList.contains('active')).toBe(false);

        // Click on child (content) should NOT close
        ModalService.open();
        const content = document.createElement('div');
        modal.appendChild(content);

        // We need to dispatch a click event manually to simulate bubbling if needed,
        // but simple click() on child works in JSDOM usually.
        // However, the listener checks e.target === this.modal

        // Mock event
        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: content });
        modal.dispatchEvent(event);

        expect(modal.classList.contains('active')).toBe(true);
    });

    it('should close on Escape key', () => {
        ModalService.open();

        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);

        expect(modal.classList.contains('active')).toBe(false);
    });

    it('should check isOpen status', () => {
        expect(ModalService.isOpen()).toBe(false);
        ModalService.open();
        expect(ModalService.isOpen()).toBe(true);
        ModalService.close();
        expect(ModalService.isOpen()).toBe(false);
    });
});

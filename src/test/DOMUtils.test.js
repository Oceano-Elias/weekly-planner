import { describe, it, expect, beforeEach } from 'vitest';
import { DOMUtils } from '../utils/DOMUtils.js';

describe('DOMUtils', () => {
    describe('createElement', () => {
        it('should create an element with the correct tag', () => {
            const el = DOMUtils.createElement('div');
            expect(el.tagName).toBe('DIV');
        });

        it('should set attributes correctly', () => {
            const el = DOMUtils.createElement('button', {
                id: 'test-btn',
                className: 'btn primary',
                disabled: true,
                'data-test': 'value',
            });

            expect(el.id).toBe('test-btn');
            expect(el.className).toBe('btn primary');
            expect(el.disabled).toBe(true);
            expect(el.getAttribute('data-test')).toBe('value');
        });

        it('should set textContent', () => {
            const el = DOMUtils.createElement('p', { textContent: 'Hello World' });
            expect(el.textContent).toBe('Hello World');
        });

        it('should set innerHTML', () => {
            const el = DOMUtils.createElement('div', { innerHTML: '<span>Test</span>' });
            expect(el.innerHTML).toBe('<span>Test</span>');
        });

        it('should apply styles object', () => {
            const el = DOMUtils.createElement('div', {
                style: {
                    color: 'red',
                    backgroundColor: 'blue',
                    fontSize: '16px',
                },
            });

            expect(el.style.color).toBe('red');
            expect(el.style.backgroundColor).toBe('blue');
            expect(el.style.fontSize).toBe('16px');
        });

        it('should append children', () => {
            const child1 = document.createElement('span');
            const child2 = 'Text Node';
            const el = DOMUtils.createElement('div', {}, [child1, child2]);

            expect(el.childNodes.length).toBe(2);
            expect(el.children[0]).toBe(child1);
            expect(el.childNodes[1].textContent).toBe('Text Node');
        });
    });

    describe('createSVG', () => {
        it('should create an SVG element with correct namespace', () => {
            const el = DOMUtils.createSVG('svg');
            expect(el.namespaceURI).toBe('http://www.w3.org/2000/svg');
            expect(el.tagName).toBe('svg');
        });

        it('should set SVG attributes', () => {
            const el = DOMUtils.createSVG('circle', {
                cx: '50',
                cy: '50',
                r: '10',
                fill: 'red',
            });

            expect(el.getAttribute('cx')).toBe('50');
            expect(el.getAttribute('cy')).toBe('50');
            expect(el.getAttribute('r')).toBe('10');
            expect(el.getAttribute('fill')).toBe('red');
        });

        it('should handle className for SVG', () => {
            const el = DOMUtils.createSVG('rect', { className: 'test-class' });
            expect(el.getAttribute('class')).toBe('test-class');
        });

        it('should append SVG children', () => {
            const child = DOMUtils.createSVG('path', { d: 'M0 0 L10 10' });
            const el = DOMUtils.createSVG('svg', {}, [child]);

            expect(el.children.length).toBe(1);
            expect(el.children[0]).toBe(child);
        });
    });

    describe('clear', () => {
        it('should remove all children from an element', () => {
            const el = document.createElement('div');
            el.appendChild(document.createElement('span'));
            el.appendChild(document.createTextNode('text'));

            expect(el.childNodes.length).toBe(2);

            DOMUtils.clear(el);

            expect(el.childNodes.length).toBe(0);
        });
    });
});

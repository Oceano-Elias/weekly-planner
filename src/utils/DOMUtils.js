/**
 * DOMUtils - Helper functions for safe DOM manipulation
 */
export const DOMUtils = {
    /**
     * Create an element with attributes and children
     * @param {string} tag - HTML tag name
     * @param {Object} attributes - Key-value pairs for attributes (use 'className' for class)
     * @param {Array<string|HTMLElement>} children - Array of children
     * @returns {HTMLElement}
     */
    createElement(tag, attributes = {}, children = []) {
        const el = document.createElement(tag);

        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                el.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    el.dataset[dataKey] = dataValue;
                });
            } else if (key === 'style' && typeof value === 'object') {
                Object.entries(value).forEach(([styleKey, styleValue]) => {
                    if (styleKey.startsWith('--')) {
                        el.style.setProperty(styleKey, styleValue);
                    } else {
                        el.style[styleKey] = styleValue;
                    }
                });
            } else if (key === 'textContent') {
                el.textContent = value;
            } else if (key === 'innerHTML') {
                el.innerHTML = value;
            } else if (key.startsWith('on') && typeof value === 'function') {
                el.addEventListener(key.substring(2).toLowerCase(), value);
            } else {
                el.setAttribute(key, value);
            }
        });

        children.forEach((child) => {
            if (typeof child === 'string') {
                el.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                el.appendChild(child);
            }
        });

        return el;
    },

    /**
     * Create an SVG element with attributes and children
     * @param {string} tag - SVG tag name
     * @param {Object} attributes - Key-value pairs for attributes
     * @param {Array<string|Element>} children - Array of children
     * @returns {SVGElement}
     */
    createSVG(tag, attributes = {}, children = []) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);

        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                el.setAttribute('class', value);
            } else if (key === 'style' && typeof value === 'object') {
                Object.entries(value).forEach(([styleKey, styleValue]) => {
                    if (styleKey.startsWith('--')) {
                        el.style.setProperty(styleKey, styleValue);
                    } else {
                        el.style[styleKey] = styleValue;
                    }
                });
            } else if (key === 'innerHTML') {
                el.innerHTML = value;
            } else {
                el.setAttribute(key, value);
            }
        });

        children.forEach((child) => {
            if (typeof child === 'string') {
                el.textContent = child;
            } else if (child instanceof Node) {
                el.appendChild(child);
            }
        });

        return el;
    },

    /**
     * Clear all children from an element
     * @param {HTMLElement} el
     */
    clear(el) {
        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }
    },
};

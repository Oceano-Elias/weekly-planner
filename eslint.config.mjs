import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default [
    js.configs.recommended,
    prettier,
    {
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                App: 'writable',
                Store: 'writable',
                Calendar: 'writable',
                TaskQueue: 'writable',
                PlannerService: 'writable',
                FocusMode: 'writable',
                FocusModeUI: 'writable',
                ConfirmModal: 'writable',
                Filters: 'writable',
                Analytics: 'writable',
                WeeklySummary: 'writable',
                UpdateNotification: 'writable',
                TaskCard: 'writable',
                DepartmentSettings: 'writable',
                FocusAudio: 'writable',
                DragDrop: 'writable',
                Chart: 'readonly',
                flatpickr: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            'prettier/prettier': 'warn',
        },
    },
    {
        ignores: ['dist/', 'src-tauri/', 'node_modules/', '*.config.js'],
    },
];

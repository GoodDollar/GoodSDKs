export default [
    {
        ignores: ["dist/**", "node_modules/**", ".turbo/**"],
    },
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parser: await import("@typescript-eslint/parser"),
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            "@typescript-eslint": await import("@typescript-eslint/eslint-plugin"),
            "react": await import("eslint-plugin-react"),
            "react-hooks": await import("eslint-plugin-react-hooks"),
        },
        rules: {
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
            "react/react-in-jsx-scope": "off",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
        },
        settings: {
            react: {
                version: "detect",
            },
        },
    },
];

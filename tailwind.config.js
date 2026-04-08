/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        './src/**/*.{ts,tsx,html}',
    ],
    theme: {
        extend: {
            colors: {
                border: 'var(--border)',
                input: 'var(--input)',
                ring: 'var(--ring)',
                background: 'var(--background)',
                foreground: 'var(--foreground)',
                primary: {
                    DEFAULT: 'var(--primary)',
                    foreground: 'var(--primary-foreground)',
                },
                secondary: {
                    DEFAULT: 'var(--secondary)',
                    foreground: 'var(--secondary-foreground)',
                },
                destructive: {
                    DEFAULT: 'var(--destructive)',
                    foreground: 'var(--destructive-foreground)',
                },
                muted: {
                    DEFAULT: 'var(--muted)',
                    foreground: 'var(--muted-foreground)',
                },
                accent: {
                    DEFAULT: 'var(--accent)',
                    foreground: 'var(--accent-foreground)',
                },
                popover: {
                    DEFAULT: 'var(--popover)',
                    foreground: 'var(--popover-foreground)',
                },
                card: {
                    DEFAULT: 'var(--card)',
                    foreground: 'var(--card-foreground)',
                },
                chart: {
                    1: 'var(--chart-1)',
                    2: 'var(--chart-2)',
                    3: 'var(--chart-3)',
                    4: 'var(--chart-4)',
                    5: 'var(--chart-5)',
                },
                sidebar: {
                    DEFAULT: 'var(--sidebar)',
                    foreground: 'var(--sidebar-foreground)',
                    primary: 'var(--sidebar-primary)',
                    'primary-foreground': 'var(--sidebar-primary-foreground)',
                    accent: 'var(--sidebar-accent)',
                    'accent-foreground': 'var(--sidebar-accent-foreground)',
                    border: 'var(--sidebar-border)',
                    ring: 'var(--sidebar-ring)',
                },
            },
            borderRadius: {
                '4xl': 'calc(var(--radius) * 2.6)',
                '3xl': 'calc(var(--radius) * 2.2)',
                '2xl': 'calc(var(--radius) * 1.8)',
                xl: 'calc(var(--radius) * 1.4)',
                lg: 'var(--radius)',
                md: 'calc(var(--radius) * 0.8)',
                sm: 'calc(var(--radius) * 0.6)',
            },
            fontFamily: {
                sans: ['Inter Variable', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
                serif: ['Georgia', 'serif'],
            },
            keyframes: {
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(24px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'scale-in': {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                'slide-up': {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'float-slow': {
                    '0%, 100%': { transform: 'translateY(-20px) rotate(-1deg)' },
                    '50%': { transform: 'translateY(20px) rotate(1deg)' },
                },
                'float-medium': {
                    '0%, 100%': { transform: 'translateY(-14px)' },
                    '50%': { transform: 'translateY(14px)' },
                },
                'float-fast': {
                    '0%, 100%': { transform: 'translateY(-8px)' },
                    '50%': { transform: 'translateY(8px)' },
                },
            },
            animation: {
                'fade-in': 'fade-in 0.8s ease',
                'scale-in': 'scale-in 0.15s ease-out',
                'slide-up': 'slide-up 0.25s ease-out',
                'float-slow': 'float-slow 8s ease-in-out infinite',
                'float-medium': 'float-medium 6s ease-in-out infinite',
                'float-fast': 'float-fast 4s ease-in-out infinite',
            },
            boxShadow: {
                'card': '0 2px 8px oklch(0.148 0.004 228.8 / 0.04)',
                'elevated': '0 8px 32px oklch(0.148 0.004 228.8 / 0.12)',
                'hero': '0 16px 64px oklch(0.148 0.004 228.8 / 0.08)',
            },
        },
    },
    plugins: [],
};

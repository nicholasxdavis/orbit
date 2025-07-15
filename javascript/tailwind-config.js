        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                                              dark: {
                            primary: '#161618',
                            secondary: '#1a1b1e',
                            tertiary: '#a1a1a2',
                            light: '#fcfcfc'
                        }
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif']
                    },
                    animation: {
                        'fade-up': 'fade-up 0.5s ease-out',
                        'fade-in': 'fade-in 0.3s ease-out',
                        'text-reveal': 'text-reveal 1.5s ease-out forwards',
                        'float': 'float 6s ease-in-out infinite',
                        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    },
                    keyframes: {
                        'fade-up': {
                            '0%': { opacity: '0', transform: 'translateY(20px)' },
                            '100%': { opacity: '1', transform: 'translateY(0)' }
                        },
                        'fade-in': {
                            '0%': { opacity: '0' },
                            '100%': { opacity: '1' }
                        },
                        'text-reveal': {
                            '0%': { 'background-size': '0% 100%' },
                            '100%': { 'background-size': '100% 100%' }
                        },
                        'float': {
                            '0%, 100%': { transform: 'translateY(0)' },
                            '50%': { transform: 'translateY(-10px)' }
                        }
                    }
                }
            }
        }
/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			primary: {
  				'50': '#f5f3ff',
  				'100': '#ede9fe',
  				'200': '#ddd6fe',
  				'300': '#c4b5fd',
  				'400': '#a78bfa',
  				'500': '#8b5cf6',
  				'600': '#7c3aed',
  				'700': '#6d28d9',
  				'800': '#5b21b6',
  				'900': '#4c1d95'
  			}
  		},
  		fontFamily: {
  			system: [
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI"',
  				'Roboto',
  				'Oxygen',
  				'Ubuntu',
  				'Cantarell',
  				'Fira Sans"',
  				'Droid Sans"',
  				'Helvetica Neue"',
  				'sans-serif'
  			]
  		},
  		letterSpacing: {
  			tight: '-0.02em'
  		},
  		maxWidth: {
  			readable: '75ch'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [
    // @tailwindcss/line-clamp is now included by default in Tailwind CSS v3.3+
    // Remove this line to eliminate the warning
  ],
}
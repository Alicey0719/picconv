/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"LINE Seed JP"', 'sans-serif'],
      },
      // LINE Seed JPのウェイトをTailwindのクラスで使いやすくする
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        regular: '400',
        medium: '500',
        bold: '700',
        black: '900',
      }
    },
  },
  plugins: [],
}
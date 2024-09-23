/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{tsx,html}"],
  theme: {
    extend: {
      fontFamily: {
        estedad: ["estedad", "sans-serif"],
        mikhak: ["mikhak", "sans-serif"],
        morabba: ["morabba", "sans-serif"],
        samim: ["samim", "sans-serif"],
        shabnam: ["shabnam", "sans-serif"],
        sahel: ["sahel", "sans-serif"],
        parastoo: ["parastoo", "sans-serif"],
        gandom: ["gandom", "sans-serif"],
        tanha: ["tanha", "sans-serif"],
        behdad: ["behdad", "sans-serif"],
        nika: ["nika", "sans-serif"],
        ganjname: ["ganjname", "sans-serif"],
        shahab: ["shahab", "sans-serif"]
      }
    }
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light"], // false: only light + dark | true: all themes | array: specific themes like this ["light", "dark", "cupcake"]
    darkTheme: "dark", // name of one of the included themes for dark mode
    base: true, // applies background color and foreground color for root element by default
    styled: true, // include daisyUI colors and design decisions for all components
    utils: true, // adds responsive and modifier utility classes
    prefix: "", // prefix for daisyUI classnames (components, modifiers and responsive class names. Not colors)
    logs: true, // Shows info about daisyUI version and used config in the console when building your CSS
    themeRoot: ":root" // The element that receives theme color CSS variables
  }
}

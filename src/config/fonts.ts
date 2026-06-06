import type { SupportedUILanguage } from "./i18n"

type LocalizedFontText = Partial<Record<SupportedUILanguage, string>>

export type DefaultFont = {
  value: string
  name: string
  author: string
  localizedName: LocalizedFontText
  localizedAuthor: LocalizedFontText
}

export const DEFAULT_FONTS = [
  {
    value: "Vazirmatn-Fontara",
    name: "وزیر",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Vazir" },
    localizedAuthor: { en: "Saber Rastikerdar" }
  },
  {
    value: "Samim-Fontara",
    name: "صمیم",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Samim" },
    localizedAuthor: { en: "Saber Rastikerdar" }
  },
  {
    value: "Shabnam-Fontara",
    name: "شبنم",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Shabnam" },
    localizedAuthor: { en: "Saber Rastikerdar" }
  },
  {
    value: "Arad-Fontara",
    name: "آراد",
    author: "محمد درویشی",
    localizedName: { en: "Arad" },
    localizedAuthor: { en: "Mohammad Darvishi" }
  },
  {
    value: "Sahel-Fontara",
    name: "ساحل",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Sahel" },
    localizedAuthor: { en: "Saber Rastikerdar" }
  },
  {
    value: "Parastoo-Fontara",
    name: "پرستو",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Parastoo" },
    localizedAuthor: { en: "Saber Rastikerdar" }
  },
  {
    value: "Gandom-Fontara",
    name: "گندم",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Gandom" },
    localizedAuthor: { en: "Saber Rastikerdar" }
  },
  {
    value: "Tanha-Fontara",
    name: "تنها",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Tanha" },
    localizedAuthor: { en: "Saber Rastikerdar" }
  },
  {
    value: "Nahid-Fontara",
    name: "ناهید",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Nahid" },
    localizedAuthor: { en: "Saber Rastikerdar" }
  },
  {
    value: "Azarmehr-Fontara",
    name: "آذرمهر",
    author: "امین عابدی",
    localizedName: { en: "Azarmehr" },
    localizedAuthor: { en: "Amin Abedi" }
  },
  {
    value: "Mikhak-Fontara",
    name: "میخک",
    author: "امین عابدی",
    localizedName: { en: "Mikhak" },
    localizedAuthor: { en: "Amin Abedi" }
  },
  {
    value: "Estedad-Fontara",
    name: "استعداد",
    author: "امین عابدی",
    localizedName: { en: "Estedad" },
    localizedAuthor: { en: "Amin Abedi" }
  },
  {
    value: "Behdad-Fontara",
    name: "بهداد",
    author: "صالح سوزنچی",
    localizedName: { en: "Behdad" },
    localizedAuthor: { en: "Saleh Souzanchi" }
  },
  {
    value: "Nika-Fontara",
    name: "نیکا",
    author: "صالح سوزنچی",
    localizedName: { en: "Nika" },
    localizedAuthor: { en: "Saleh Souzanchi" }
  },
  {
    value: "Ganjname-Fontara",
    name: "گنج نامه",
    author: "صالح سوزنچی",
    localizedName: { en: "Ganjnameh" },
    localizedAuthor: { en: "Saleh Souzanchi" }
  },
  {
    value: "Shahab-Fontara",
    name: "شهاب",
    author: "صالح سوزنچی",
    localizedName: { en: "Shahab" },
    localizedAuthor: { en: "Saleh Souzanchi" }
  }
] satisfies DefaultFont[]

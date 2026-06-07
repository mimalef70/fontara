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
    localizedName: { en: "Vazir", ar: "وزير" },
    localizedAuthor: { en: "Saber Rastikerdar", ar: "الراحل صابر راستي كردار" }
  },
  {
    value: "Samim-Fontara",
    name: "صمیم",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Samim", ar: "صميم" },
    localizedAuthor: { en: "Saber Rastikerdar", ar: "الراحل صابر راستي كردار" }
  },
  {
    value: "Shabnam-Fontara",
    name: "شبنم",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Shabnam", ar: "شبنم" },
    localizedAuthor: { en: "Saber Rastikerdar", ar: "الراحل صابر راستي كردار" }
  },
  {
    value: "Arad-Fontara",
    name: "آراد",
    author: "محمد درویشی",
    localizedName: { en: "Arad", ar: "آراد" },
    localizedAuthor: { en: "Mohammad Darvishi", ar: "محمد درويشي" }
  },
  {
    value: "Sahel-Fontara",
    name: "ساحل",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Sahel", ar: "ساحل" },
    localizedAuthor: { en: "Saber Rastikerdar", ar: "الراحل صابر راستي كردار" }
  },
  {
    value: "Parastoo-Fontara",
    name: "پرستو",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Parastoo", ar: "پرستو" },
    localizedAuthor: { en: "Saber Rastikerdar", ar: "الراحل صابر راستي كردار" }
  },
  {
    value: "Gandom-Fontara",
    name: "گندم",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Gandom", ar: "گندم" },
    localizedAuthor: { en: "Saber Rastikerdar", ar: "الراحل صابر راستي كردار" }
  },
  {
    value: "Tanha-Fontara",
    name: "تنها",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Tanha", ar: "تنها" },
    localizedAuthor: { en: "Saber Rastikerdar", ar: "الراحل صابر راستي كردار" }
  },
  {
    value: "Nahid-Fontara",
    name: "ناهید",
    author: "زنده یاد صابر راستی کردار",
    localizedName: { en: "Nahid", ar: "ناهيد" },
    localizedAuthor: { en: "Saber Rastikerdar", ar: "الراحل صابر راستي كردار" }
  },
  {
    value: "Azarmehr-Fontara",
    name: "آذرمهر",
    author: "امین عابدی",
    localizedName: { en: "Azarmehr", ar: "آذرمهر" },
    localizedAuthor: { en: "Amin Abedi", ar: "أمين عابدي" }
  },
  {
    value: "Mikhak-Fontara",
    name: "میخک",
    author: "امین عابدی",
    localizedName: { en: "Mikhak", ar: "ميخك" },
    localizedAuthor: { en: "Amin Abedi", ar: "أمين عابدي" }
  },
  {
    value: "Estedad-Fontara",
    name: "استعداد",
    author: "امین عابدی",
    localizedName: { en: "Estedad", ar: "استعداد" },
    localizedAuthor: { en: "Amin Abedi", ar: "أمين عابدي" }
  },
  {
    value: "Behdad-Fontara",
    name: "بهداد",
    author: "صالح سوزنچی",
    localizedName: { en: "Behdad", ar: "بهداد" },
    localizedAuthor: { en: "Saleh Souzanchi", ar: "صالح سوزنجي" }
  },
  {
    value: "Nika-Fontara",
    name: "نیکا",
    author: "صالح سوزنچی",
    localizedName: { en: "Nika", ar: "نيكا" },
    localizedAuthor: { en: "Saleh Souzanchi", ar: "صالح سوزنجي" }
  },
  {
    value: "Ganjname-Fontara",
    name: "گنج نامه",
    author: "صالح سوزنچی",
    localizedName: { en: "Ganjnameh", ar: "گنج نامه" },
    localizedAuthor: { en: "Saleh Souzanchi", ar: "صالح سوزنجي" }
  },
  {
    value: "Shahab-Fontara",
    name: "شهاب",
    author: "صالح سوزنچی",
    localizedName: { en: "Shahab", ar: "شهاب" },
    localizedAuthor: { en: "Saleh Souzanchi", ar: "صالح سوزنجي" }
  }
] satisfies DefaultFont[]

// Font imports
import fontBehdad from "data-base64:../../assets/fonts/behdad/variable/Behdad-Regular.woff"
import fontDana from "data-base64:../../assets/fonts/dana/variable/Dana-Regular.woff2"
import fontEstedad from "data-base64:../../assets/fonts/estedad/variable/Estedad[KSHD,wght].woff2"
import fontGandom from "data-base64:../../assets/fonts/gandom/variable/Gandom-WOL.woff"
import fontGanjname from "data-base64:../../assets/fonts/ganjname/variable/GanjNamehSans-Regular.woff2"
import fontMikhak from "data-base64:../../assets/fonts/mikhak/variable/Mikhak-Regular.woff2"
import fontMorraba from "data-base64:../../assets/fonts/morraba/variable/MorabbaVF.woff2"
import fontNika from "data-base64:../../assets/fonts/nika/variable/Nika-Regular.woff2"
import fontParastoo from "data-base64:../../assets/fonts/parastoo/variable/Parastoo-WOL.woff"
import fontSahel from "data-base64:../../assets/fonts/sahel/variable/Sahel-WOL.woff"
import fontSamim from "data-base64:../../assets/fonts/samim/variable/Samim-WOL.woff"
import fontShabnam from "data-base64:../../assets/fonts/shabnam/variable/Shabnam-WOL.woff"
import fontShahab from "data-base64:../../assets/fonts/shahab/variable/Shahab-Regular.woff2"
import fontTanha from "data-base64:../../assets/fonts/tanha/variable/Tanha-WOL.woff"
import fontVazirmatn from "data-base64:../../assets/fonts/vazir/Vazirmatn-Regular.woff2"

import type { FontRecord } from "~src/utils/types"

export const googleFonts: FontRecord = {
  Vazirmatn: "https://fonts.googleapis.com/css2?family=Vazirmatn&display=swap"
}
// Font definitions
export const localFonts: FontRecord = {
  Behdad: fontBehdad,
  Dana: fontDana,
  Estedad: fontEstedad,
  Gandom: fontGandom,
  Ganjname: fontGanjname,
  Mikhak: fontMikhak,
  Morraba: fontMorraba,
  Nika: fontNika,
  Parastoo: fontParastoo,
  Sahel: fontSahel,
  Samim: fontSamim,
  Shabnam: fontShabnam,
  Shahab: fontShahab,
  Tanha: fontTanha,
  Vazirmatn: fontVazirmatn
}

export const defaultFonts = [
  {
    value: "Vazirmatn",
    name: "وزیر",
    svg: "بستد دل و دین از من",
    style: "font-vazirmatn"
  },
  {
    value: "Estedad",
    name: "استعداد",
    svg: "بستد دل و دین از من",
    style: "font-estedad"
  },
  {
    value: "Morraba",
    name: "مربا",
    svg: "بستد دل و دین از من",
    style: "font-morabba"
  },
  {
    value: "Dana",
    name: "دانا",
    svg: "بستد دل و دین از من",
    style: "font-dana"
  },
  {
    value: "Samim",
    name: "صمیم",
    svg: "بستد دل و دین از من",
    style: "font-samim"
  },
  {
    value: "Shabnam",
    name: "شبنم",
    svg: "بستد دل و دین از من",
    style: "font-shabnam"
  },
  {
    value: "Sahel",
    name: "ساحل",
    svg: "بستد دل و دین از من",
    style: "font-sahel"
  },
  {
    Value: "Parastoo",
    name: "پرستو",
    svg: "بستد دل و دین از من",
    style: "font-parastoo"
  },
  {
    value: "Gandom",
    name: "گندم",
    svg: "بستد دل و دین از من",
    style: "font-gandom"
  },
  {
    value: "Tanha",
    name: "تنها",
    svg: "بستد دل و دین از من",
    style: "font-tanha"
  },
  {
    value: "Behdad",
    name: "بهداد",
    svg: "بستد دل و دین از من",
    style: "font-behdad"
  },
  {
    value: "Nika",
    name: "نیکا",
    svg: "بستد دل و دین از من",
    style: "font-nika"
  },
  {
    value: "Ganjname",
    name: "گنج نامه",
    svg: "بستد دل و دین از من",
    style: "font-ganjname"
  },
  {
    value: "Shahab",
    name: "شهاب",
    svg: "بستد دل و دین از من",
    style: "font-shahab"
  },
  {
    value: "Mikhak",
    name: "میخک",
    svg: "بستد دل و دین از من",
    style: "font-mikhak"
  }
]

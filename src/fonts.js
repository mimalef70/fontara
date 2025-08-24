import Behdad from "raw:../assets/fonts/behdad/Behdad-Regular.woff2"
import Estedad from "raw:../assets/fonts/estedad/variable/Estedad[KSHD,wght].woff2"
import Gandom from "raw:../assets/fonts/gandom/Gandom.woff2"
import Ganjname from "raw:../assets/fonts/ganjname/GanjNamehSans-Regular.woff2"
import Mikhak from "raw:../assets/fonts/mikhak/variable/Mikhak[DSTY,KSHD,wght].woff2"
import Nahid from "raw:../assets/fonts/nahid/Nahid.woff2"
import Nika from "raw:../assets/fonts/nika/Nika-Regular.woff2"
import ParastooBold from "raw:../assets/fonts/parastoo/Parastoo-Bold.woff2"
import Parastoo from "raw:../assets/fonts/parastoo/Parastoo.woff2"
import Sahel from "raw:../assets/fonts/sahel/variable/Sahel-VF.woff2"
import SamimBold from "raw:../assets/fonts/samim/Samim-Bold.woff2"
import SamimMedium from "raw:../assets/fonts/samim/Samim-Medium.woff2"
import Samim from "raw:../assets/fonts/samim/Samim.woff2"
import ShabnamBold from "raw:../assets/fonts/shabnam/Shabnam-Bold.woff2"
import ShabnamLight from "raw:../assets/fonts/shabnam/Shabnam-Light.woff2"
import ShabnamMedium from "raw:../assets/fonts/shabnam/Shabnam-Medium.woff2"
import ShabnamThin from "raw:../assets/fonts/shabnam/Shabnam-Thin.woff2"
import Shabnam from "raw:../assets/fonts/shabnam/Shabnam.woff2"
import Shahab from "raw:../assets/fonts/shahab/Shahab-Regular.woff2"
import Tanha from "raw:../assets/fonts/tanha/Tanha.woff2"
import Vazirmatn from "raw:../assets/fonts/vazir/variable/Vazirmatn[wght].woff2"

export function getFonts() {
  return `
/* ========== Vazirmatn ========== */
@font-face {
  font-family: "Vazirmatn-Fontara";
  src:
    url(${Vazirmatn})
      format("woff2 supports variations"),
    url(${Vazirmatn})
      format("woff2-variations");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Estedad ========== */
@font-face {
  font-family: "Estedad-Fontara";
  src:
    url(${Estedad})
      format("woff2 supports variations"),
    url(${Estedad})
      format("woff2-variations");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Samim ========== */
@font-face {
  font-family: "Samim-Fontara";
  src: url(${Samim}) format("woff2");
  font-weight: normal;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

@font-face {
  font-family: "Samim-Fontara";
  src: url(${SamimMedium}) format("woff2");
  font-weight: 500;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

@font-face {
  font-family: "Samim-Fontara";
  src: url(${SamimBold}) format("woff2");
  font-weight: bold;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Shabnam ========== */
@font-face {
  font-family: "Shabnam-Fontara";
  src: url(${Shabnam}) format("woff2");
  font-weight: normal;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}
@font-face {
  font-family: "Shabnam-Fontara";
  src: url(${ShabnamThin}) format("woff2");
  font-weight: 100;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}
@font-face {
  font-family: "Shabnam-Fontara";
  src: url(${ShabnamLight}) format("woff2");
  font-weight: 300;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

@font-face {
  font-family: "Shabnam-Fontara";
  src: url(${ShabnamMedium})
    format("woff2");
  font-weight: 500;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}
@font-face {
  font-family: "Shabnam-Fontara";
  src: url(${ShabnamBold}) format("woff2");
  font-weight: bold;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Sahel ========== */
@font-face {
  font-family: "Sahel-Fontara";
  src:
    url(${Sahel})
      format("woff2 supports variations"),
    url(${Sahel})
      format("woff2-variations");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Parastoo ========== */
@font-face {
  font-family: "Parastoo-Fontara";
  src: url(${Parastoo}) format("woff2");
  font-weight: normal;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}
@font-face {
  font-family: "Parastoo-Fontara";
  src: url(${ParastooBold})
    format("woff2");
  font-weight: bold;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Gandom ========== */
@font-face {
  font-family: "Gandom-Fontara";
  src: url(${Gandom}) format("woff2");
  font-weight: normal;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Tanha ========== */
@font-face {
  font-family: "Tanha-Fontara";
  src: url(${Tanha}) format("woff2");
  font-weight: normal;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Behdad ========== */
@font-face {
  font-family: "Behdad-Fontara";
  src: url(${Behdad}) format("woff2");
  font-weight: normal;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Nika ========== */
@font-face {
  font-family: "Nika-Fontara";
  src: url(${Nika}) format("woff2");
  font-weight: normal;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Ganjname ========== */
@font-face {
  font-family: "Ganjname-Fontara";
  src: url(${Ganjname})
    format("woff2");
  font-weight: normal;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Shahab ========== */
@font-face {
  font-family: "Shahab-Fontara";
  src: url(${Shahab}) format("woff2");
  font-weight: normal;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Mikhak ========== */
@font-face {
  font-family: "Mikhak-Fontara";
  src:
    url(${Mikhak})
      format("woff2 supports variations"),
    url(${Mikhak})
      format("woff2-variations");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Nahid ========== */
@font-face {
  font-family: "Nahid-Fontara";
  src: url(${Nahid});
  font-weight: normal;
  font-style: normal;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}

/* ========== Azarmehr ========== */
@font-face {
  font-family: "Azarmehr-Fontara";
  src:
    url("data:font/woff2;base64,d09GMgABAAAAAPasABYAAAADLYAAAPYqAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGoYrG+M6HJZkP0hWQVKPTD9NVkFSbgZgP1NUQVSDDCdqAItuL4YcEQgKgrxMgo8LMIf0YgE2AiQDlRgLik4ABCA/bWV0YTwFtC4HqRUMB1vvD5MFMWPsjneoJlC1ytbhHcOWL+ljK5wQRS7tfEBPMZytJWP/8Summzvldgp+87tNsv//////X7NMZMwuQf+StLSAgMJUVZ267TWaOwJhgZTbIioicnRISMmUzl3x3kMM6LAblVqmaSJBkPpIxUDFqVoxo3DMZhROuaPv5QHd4mLhSiXKrH2FNd7zn3DU+12TeT7ZWH2KrJ4vVi8WOKYsrlFTshOSpXPy0zl7zuwyMXvnsV+w3o7NDxgO6nn7zjhpd9XYoK6i38SqPu5PZPldF+Xltk4yrtVrQSSKsaHrY7d35TaopDKs70BI++BHDu5wuXPPIb31ObC+EwydODf4FWWaTrckTttX/p4J/2GBL2JA//QgXsKrSmoEVbKpOaZW3AMm4+0wFPGOyPiGB0OhINoW5oQ5Ye5oQRFhVgTHWLIIlL+IIPqUkqMH4x1FMbCQIreGvhpSG4HK6sFMMINOJCKZu7TcGqyUNIBqpeZUKZjLyZFPwwM/MMNwKfuCNCOh/EjKS7oo7ujeM/oQ08S42bL7aPN4b5CR2/PY6Kb/Np8b/zyvMxcxKhTc3Pfm29q8cFv+5I3qgUphwxsmmiS4MfM1+EJ5rOIlj46HBQwdogrHJysEh94WFMWa+lUbztpT/XB77qiXRUS05T783rJOqqRKbmwdYLfMXgYTslKOUuIn/MPTnP09b2YihoUAwa1FG6xBvEKpyorJp6QrYt4V6+rvejNEudlsPhLIRwghhAAJT4iAgBAQ+RpCQFS0Fj3F5z1qrU9rqWc9a6kk+FQpIgpSFESK")
      format("woff2 supports variations"),
    url("data:font/woff2;base64,d09GMgABAAAAAPasABYAAAADLYAAAPYqAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGoYrG+M6HJZkP0hWQVKPTD9NVkFSbgZgP1NUQVSDDCdqAItuL4YcEQgKgrxMgo8LMIf0YgE2AiQDlRgLik4ABCA/bWV0YTwFtC4HqRUMB1vvD5MFMWPsjneoJlC1ytbhHcOWL+ljK5wQRS7tfEBPMZytJWP/8Summzvldgp+87tNsv//////X7NMZMwuQf+StLSAgMJUVZ267TWaOwJhgZTbIioicnRISMmUzl3x3kMM6LAblVqmaSJBkPpIxUDFqVoxo3DMZhROuaPv5QHd4mLhSiXKrH2FNd7zn3DU+12TeT7ZWH2KrJ4vVi8WOKYsrlFTshOSpXPy0zl7zuwyMXvnsV+w3o7NDxgO6nn7zjhpd9XYoK6i38SqPu5PZPldF+Xltk4yrtVrQSSKsaHrY7d35TaopDKs70BI++BHDu5wuXPPIb31ObC+EwydODf4FWWaTrckTttX/p4J/2GBL2JA//QgXsKrSmoEVbKpOaZW3AMm4+0wFPGOyPiGB0OhINoW5oQ5Ye5oQRFhVgTHWLIIlL+IIPqUkqMH4x1FMbCQIreGvhpSG4HK6sFMMINOJCKZu7TcGqyUNIBqpeZUKZjLyZFPwwM/MMNwKfuCNCOh/EjKS7oo7ujeM/oQ08S42bL7aPN4b5CR2/PY6Kb/Np8b/zyvMxcxKhTc3Pfm29q8cFv+5I3qgUphwxsmmiS4MfM1+EJ5rOIlj46HBQwdogrHJysEh94WFMWa+lUbztpT/XB77qiXRUS05T783rJOqqRKbmwdYLfMXgYTslKOUuIn/MPTnP09b2YihoUAwa1FG6xBvEKpyorJp6QrYt4V6+rvejNEudlsPhLIRwghhAAJT4iAgBAQ+RpCQFS0Fj3F5z1qrU9rqWc9a6kk+FQpIgpSFESK")
      format("woff2-variations");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF;
}
      `
}

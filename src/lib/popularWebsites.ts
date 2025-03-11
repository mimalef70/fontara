import crisp from "url:~assets/logos/crisp-active.png"
import dropbox from "url:~assets/logos/dropbox-active.png"
import duckduckgo from "url:~assets/logos/duckduckgo-active.png"
import facebook from "url:~assets/logos/facebook-active.png"
import feedly from "url:~assets/logos/feedly-active.png"
import getpocket from "url:~assets/logos/getpocket-active.png"
import github from "url:~assets/logos/github-active.png"
import gmail from "url:~assets/logos/gmail-active.png"
import goodreads from "url:~assets/logos/goodreads-active.png"
import google from "url:~assets/logos/google-active.png"
import inoreader from "url:~assets/logos/inoreader-active.png"
import instagram from "url:~assets/logos/instagram-active.png"
import linkedin from "url:~assets/logos/linkedin-active.png"
import medium from "url:~assets/logos/medium-active.png"
import messagesandroid from "url:~assets/logos/messagesandroid-active.png"
import npm from "url:~assets/logos/npm-active.png"
import slack from "url:~assets/logos/slack-active.png"
import telegram from "url:~assets/logos/telegram-active.png"
import trello from "url:~assets/logos/trello-active.png"
import twitter from "url:~assets/logos/twitter-active.png"
import virgool from "url:~assets/logos/virgool-active.png"
import whatsapp from "url:~assets/logos/whatsapp-active.png"
import wikipedia from "url:~assets/logos/wikipedia-active.png"
import wordpress from "url:~assets/logos/wordpress-active.png"
import youtube from "url:~assets/logos/youtube-active.png"

import type { WebsiteItem } from "./types"

export const popularWebsites: WebsiteItem[] = [
  {
    url: "https://app.crisp.chat",
    regex: "^https://app\\.crisp\\.chat/.*$",
    icon: crisp,
    pattern: "https://app.crisp.chat/*"
  },
  {
    url: "https://www.dropbox.com",
    regex: "^https://www\\.[^/]*dropbox\\.com/.*$",
    icon: dropbox,
    pattern: "https://www.*dropbox.com/*"
  },
  {
    url: "https://duckduckgo.com",
    regex: "^https://duckduckgo\\.com/.*$",
    icon: duckduckgo,
    pattern: "https://duckduckgo.com/*"
  },
  {
    url: "https://www.facebook.com",
    regex: "^https://www\\.facebook\\.com/.*$",
    icon: facebook,
    pattern: "https://www.facebook.com/*"
  },
  {
    url: "https://feedly.com",
    regex: "^https://feedly\\.com/.*$",
    icon: feedly,
    pattern: "https://feedly.com/*"
  },
  {
    url: "https://getpocket.com",
    regex: "^https://getpocket\\.com/.*$",
    icon: getpocket,
    pattern: "https://getpocket.com/*"
  },
  {
    url: "https://github.com",
    regex: "^https://github\\.com/.*$",
    icon: github,
    pattern: "https://github.com/*"
  },
  {
    url: "https://mail.google.com",
    regex: "^https://mail\\.google\\.com/.*$",
    icon: gmail,
    pattern: "https://mail.google.com/*"
  },
  {
    url: "https://www.goodreads.com",
    regex: "^https://www\\.goodreads\\.com/.*$",
    icon: goodreads,
    pattern: "https://www.goodreads.com/*"
  },
  {
    url: "https://www.google.com",
    regex: "^https://www\\.google\\.com/.*$",
    icon: google,
    pattern: "https://www.google.com/*"
  },
  {
    url: "https://www.inoreader.com",
    regex: "^https://www\\.inoreader\\.com/.*$",
    icon: inoreader,
    pattern: "https://www.inoreader.com/*"
  },
  {
    url: "https://www.instagram.com",
    regex: "^https://www\\.instagram\\.com/.*$",
    icon: instagram,
    pattern: "https://www.instagram.com/*"
  },
  {
    url: "https://www.linkedin.com",
    regex: "^https://[^/]*linkedin\\.com/.*$",
    icon: linkedin,
    pattern: "https://*linkedin.com/*"
  },
  {
    url: "https://medium.com",
    regex: "^https://medium\\.com/.*$",
    icon: medium,
    pattern: "https://medium.com/*"
  },
  {
    url: "https://messages.google.com",
    regex: "^https://messages\\.google\\.com/.*$",
    icon: messagesandroid,
    pattern: "https://messages.google.com/*"
  },
  {
    url: "https://slack.com",
    regex: "^https://slack\\.com/.*$",
    icon: slack,
    pattern: "https://slack.com/*"
  },
  {
    url: "https://web.telegram.org",
    regex: "^https://web\\.telegram\\.org/.*$",
    icon: telegram,
    pattern: "https://web.telegram.org/*"
  },
  {
    url: "https://trello.com",
    regex: "^https://trello\\.com/.*$",
    icon: trello,
    pattern: "https://trello.com/*"
  },
  {
    url: "https://x.com",
    regex: "^https://x\\.com/.*$",
    icon: twitter,
    pattern: "https://x.com/*"
  },
  {
    url: "https://virgool.io",
    regex: "^https://virgool\\.io/.*$",
    icon: virgool,
    pattern: "https://virgool.io/*"
  },
  {
    url: "https://web.whatsapp.com",
    regex: "^https://web\\.whatsapp\\.com/.*$",
    icon: whatsapp,
    pattern: "https://web.whatsapp.com/*"
  },
  {
    url: "https://www.wikipedia.org",
    regex: "^https://[^/]*\\.wikipedia\\.org/.*$",
    icon: wikipedia,
    pattern: "https://*.wikipedia.org/*"
  },
  {
    url: "https://wordpress.org",
    regex: "^https://[^/]*\\.wordpress\\.org/.*$",
    icon: wordpress,
    pattern: "https://*.wordpress.org/*"
  },
  {
    url: "https://www.youtube.com",
    regex: "^https://www\\.youtube\\.com/.*$",
    icon: youtube,
    pattern: "https://www.youtube.com/*"
  },
  {
    url: "https://www.npmjs.com",
    regex: "^https://www\\.npmjs\\.com/.*$",
    icon: npm,
    pattern: "https://www.npmjs.com/*"
  }
]

import chatgpt from "url:~assets/logos/chatgpt-active.svg"
import crisp from "url:~assets/logos/crisp-active.svg"
import dropbox from "url:~assets/logos/dropbox-active.svg"
import duckduckgo from "url:~assets/logos/duckduckgo-active.svg"
import facebook from "url:~assets/logos/facebook-active.svg"
import feedly from "url:~assets/logos/feedly-active.svg"
import getpocket from "url:~assets/logos/getpocket-active.svg"
import github from "url:~assets/logos/github-active.svg"
import gmail from "url:~assets/logos/gmail-active.svg"
import goodreads from "url:~assets/logos/goodreads-active.svg"
import google from "url:~assets/logos/google-active.svg"
import inoreader from "url:~assets/logos/inoreader-active.svg"
import instagram from "url:~assets/logos/instagram-active.svg"
import linkedin from "url:~assets/logos/linkedin-active.svg"
import medium from "url:~assets/logos/medium-active.svg"
import messagesandroid from "url:~assets/logos/messagesandroid-active.svg"
import slack from "url:~assets/logos/slack-active.svg"
import telegram from "url:~assets/logos/telegram-active.svg"
import trello from "url:~assets/logos/trello-active.svg"
import twitter from "url:~assets/logos/twitter-active.svg"
//import virgool from "url:~assets/logos/virgool-active.svg"
import whatsapp from "url:~assets/logos/whatsapp-active.svg"
import wikipedia from "url:~assets/logos/wikipedia-active.svg"
import wordpress from "url:~assets/logos/wordpress-active.svg"
import youtube from "url:~assets/logos/youtube-active.svg"
import x from "url:~assets/logos/x-active.svg"
import whatsappCss from "url:~assets/styles/whatsapp.css"

import type { WebsiteItem } from "./types"

export const popularWebsites: WebsiteItem[] = [
  // {
  //   url: "https://app.crisp.chat",
  //   regex: "^https://app\\.crisp\\.chat/.*$",
  //   icon: crisp,
  //   pattern: "https://app.crisp.chat/*",
  //   siteName: "Crisp"
  // },
  {
    url: "https://www.linkedin.com",
    regex: "^https://[^/]*linkedin\\.com/.*$",
    icon: linkedin,
    pattern: "https://*linkedin.com/*",
    siteName: "LinkedIn"
  },
  {
    url: "https://x.com",
    regex: "^https://x\\.com/.*$",
    icon: x,
    pattern: "https://x.com/*",
    siteName: "X"
  },
  {
    url: "https://www.facebook.com",
    regex: "^https://www\\.facebook\\.com/.*$",
    icon: facebook,
    pattern: "https://www.facebook.com/*",
    siteName: "Facebook"
  },
  {
    url: "https://www.instagram.com",
    regex: "^https://www\\.instagram\\.com/.*$",
    icon: instagram,
    pattern: "https://www.instagram.com/*",
    siteName: "Instagram"
  },
  {
    url: "https://chatgpt.com",
    regex: "^https://chatgpt\\.com/.*$",
    icon: chatgpt,
    pattern: "https://chatgpt.com/*",
    siteName: "ChatGPT"
  },
  // {
  //   url: "https://getpocket.com",
  //   regex: "^https://getpocket\\.com/.*$",
  //   icon: getpocket,
  //   pattern: "https://getpocket.com/*",
  //   siteName: "Pocket"
  // },
  {
    url: "https://www.google.com",
    regex: "^https://www\\.google\\.com/.*$",
    icon: google,
    pattern: "https://www.google.com/*",
    siteName: "Google"
  },
  {
    url: "https://mail.google.com",
    regex: "^https://mail\\.google\\.com/.*$",
    icon: gmail,
    pattern: "https://mail.google.com/*",
    siteName: "Gmail"
  },
  {
    url: "https://web.telegram.org",
    regex: "^https://web\\.telegram\\.org/.*$",
    icon: telegram,
    pattern: "https://web.telegram.org/*",
    siteName: "Telegram"
  },
  {
    url: "https://web.whatsapp.com",
    regex: "^https://web\\.whatsapp\\.com/.*$",
    icon: whatsapp,
    pattern: "https://web.whatsapp.com/*",
    siteName: "WhatsApp",
    customCss: whatsappCss,
    version: "4.1.1"
  },
  {
    url: "https://github.com",
    regex: "^https://github\\.com/.*$",
    icon: github,
    pattern: "https://github.com/*",
    siteName: "GitHub"
  },
  {
    url: "https://www.goodreads.com",
    regex: "^https://www\\.goodreads\\.com/.*$",
    icon: goodreads,
    pattern: "https://www.goodreads.com/*",
    siteName: "Goodreads"
  },
  // {
  //   url: "https://www.inoreader.com",
  //   regex: "^https://www\\.inoreader\\.com/.*$",
  //   icon: inoreader,
  //   pattern: "https://www.inoreader.com/*",
  //   siteName: "Inoreader"
  // },
  {
    url: "https://medium.com",
    regex: "^https://medium\\.com/.*$",
    icon: medium,
    pattern: "https://medium.com/*",
    siteName: "Medium"
  },
  {
    url: "https://messages.google.com",
    regex: "^https://messages\\.google\\.com/.*$",
    icon: messagesandroid,
    pattern: "https://messages.google.com/*",
    siteName: "Messages"
  },
  {
    url: "https://slack.com",
    regex: "^https://slack\\.com/.*$",
    icon: slack,
    pattern: "https://slack.com/*",
    siteName: "Slack"
  },
  {
    url: "https://www.dropbox.com",
    regex: "^https://www\\.[^/]*dropbox\\.com/.*$",
    icon: dropbox,
    pattern: "https://www.*dropbox.com/*",
    siteName: "Dropbox"
  },
  {
    url: "https://duckduckgo.com",
    regex: "^https://duckduckgo\\.com/.*$",
    icon: duckduckgo,
    pattern: "https://duckduckgo.com/*",
    siteName: "DuckDuckGo"
  },
  {
    url: "https://trello.com",
    regex: "^https://trello\\.com/.*$",
    icon: trello,
    pattern: "https://trello.com/*",
    siteName: "Trello"
  },
  // {
  //   url: "https://virgool.io",
  //   regex: "^https://virgool\\.io/.*$",
  //   icon: virgool,
  //   pattern: "https://virgool.io/*",
  //   siteName: "Virgool"
  // },
  {
    url: "https://www.wikipedia.org",
    regex: "^https://[^/]*\\.wikipedia\\.org/.*$",
    icon: wikipedia,
    pattern: "https://*.wikipedia.org/*",
    siteName: "Wikipedia"
  },
  {
    url: "https://wordpress.org",
    regex: "^https://[^/]*\\.wordpress\\.org/.*$",
    icon: wordpress,
    pattern: "https://*.wordpress.org/*",
    siteName: "WordPress"
  },
  {
    url: "https://www.youtube.com",
    regex: "^https://www\\.youtube\\.com/.*$",
    icon: youtube,
    pattern: "https://www.youtube.com/*",
    siteName: "YouTube"
  }
  // {
  //   url: "https://feedly.com",
  //   regex: "^https://feedly\\.com/.*$",
  //   icon: feedly,
  //   pattern: "https://feedly.com/*",
  //   siteName: "Feedly"
  // }
]

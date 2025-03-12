import chatgpt from "url:~assets/logos/chatgpt-active.png"
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
import slack from "url:~assets/logos/slack-active.png"
import telegram from "url:~assets/logos/telegram-active.png"
import trello from "url:~assets/logos/trello-active.png"
import twitter from "url:~assets/logos/twitter-active.png"
import virgool from "url:~assets/logos/virgool-active.png"
import whatsapp from "url:~assets/logos/whatsapp-active.png"
import wikipedia from "url:~assets/logos/wikipedia-active.png"
import wordpress from "url:~assets/logos/wordpress-active.png"
import youtube from "url:~assets/logos/youtube-active.png"
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
    url: "https://www.facebook.com",
    regex: "^https://www\\.facebook\\.com/.*$",
    icon: facebook,
    pattern: "https://www.facebook.com/*",
    siteName: "Facebook"
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
    url: "https://github.com",
    regex: "^https://github\\.com/.*$",
    icon: github,
    pattern: "https://github.com/*",
    siteName: "GitHub"
  },
  {
    url: "https://mail.google.com",
    regex: "^https://mail\\.google\\.com/.*$",
    icon: gmail,
    pattern: "https://mail.google.com/*",
    siteName: "Gmail"
  },
  {
    url: "https://www.goodreads.com",
    regex: "^https://www\\.goodreads\\.com/.*$",
    icon: goodreads,
    pattern: "https://www.goodreads.com/*",
    siteName: "Goodreads"
  },
  {
    url: "https://www.google.com",
    regex: "^https://www\\.google\\.com/.*$",
    icon: google,
    pattern: "https://www.google.com/*",
    siteName: "Google"
  },
  // {
  //   url: "https://www.inoreader.com",
  //   regex: "^https://www\\.inoreader\\.com/.*$",
  //   icon: inoreader,
  //   pattern: "https://www.inoreader.com/*",
  //   siteName: "Inoreader"
  // },
  {
    url: "https://www.instagram.com",
    regex: "^https://www\\.instagram\\.com/.*$",
    icon: instagram,
    pattern: "https://www.instagram.com/*",
    siteName: "Instagram"
  },
  {
    url: "https://www.linkedin.com",
    regex: "^https://[^/]*linkedin\\.com/.*$",
    icon: linkedin,
    pattern: "https://*linkedin.com/*",
    siteName: "LinkedIn"
  },
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
    url: "https://web.telegram.org",
    regex: "^https://web\\.telegram\\.org/.*$",
    icon: telegram,
    pattern: "https://web.telegram.org/*",
    siteName: "Telegram"
  },
  {
    url: "https://trello.com",
    regex: "^https://trello\\.com/.*$",
    icon: trello,
    pattern: "https://trello.com/*",
    siteName: "Trello"
  },
  {
    url: "https://x.com",
    regex: "^https://x\\.com/.*$",
    icon: twitter,
    pattern: "https://x.com/*",
    siteName: "Twitter"
  },
  {
    url: "https://virgool.io",
    regex: "^https://virgool\\.io/.*$",
    icon: virgool,
    pattern: "https://virgool.io/*",
    siteName: "Virgool"
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
    url: "https://www.wikipedia.org",
    regex: "^https://[^/]*\\.wikipedia\\.org/.*$",
    icon: wikipedia,
    pattern: "https://*.wikipedia.org/*",
    siteName: "Wikipedia"
  },
  // {
  //   url: "https://wordpress.org",
  //   regex: "^https://[^/]*\\.wordpress\\.org/.*$",
  //   icon: wordpress,
  //   pattern: "https://*.wordpress.org/*",
  //   siteName: "WordPress"
  // },
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

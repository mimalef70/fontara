import type { WebsiteItem } from "../definitions"

export const POPULAR_WEBSITES: WebsiteItem[] = [
  {
    url: "https://www.linkedin.com",
    regex: "^https://[^/]*linkedin\\.com/.*$",
    icon: "assets/logos/linkedin-active.svg",
    pattern: "https://*linkedin.com/*",
    siteName: "LinkedIn"
  },
  {
    url: "https://x.com",
    regex: "^https://x\\.com/.*$",
    icon: "assets/logos/x-active.svg",
    pattern: "https://x.com/*",
    siteName: "X"
  },
  {
    url: "https://www.facebook.com",
    regex: "^https://www\\.facebook\\.com/.*$",
    icon: "assets/logos/facebook-active.svg",
    pattern: "https://www.facebook.com/*",
    siteName: "Facebook"
  },
  {
    url: "https://www.instagram.com",
    regex: "^https://www\\.instagram\\.com/.*$",
    icon: "assets/logos/instagram-active.svg",
    pattern: "https://www.instagram.com/*",
    siteName: "Instagram"
  },
  {
    url: "https://chatgpt.com",
    regex: "^https://chatgpt\\.com/.*$",
    icon: "assets/logos/chatgpt-active.svg",
    pattern: "https://chatgpt.com/*",
    siteName: "ChatGPT"
  },
  {
    url: "https://www.google.com",
    regex: "^https://www\\.google\\.com/.*$",
    icon: "assets/logos/google-active.svg",
    pattern: "https://www.google.com/*",
    siteName: "Google"
  },
  {
    url: "https://mail.google.com",
    regex: "^https://mail\\.google\\.com/.*$",
    icon: "assets/logos/gmail-active.svg",
    pattern: "https://mail.google.com/*",
    siteName: "Gmail"
  },
  {
    url: "https://web.telegram.org",
    regex: "^https://web\\.telegram\\.org/.*$",
    icon: "assets/logos/telegram-active.svg",
    pattern: "https://web.telegram.org/*",
    siteName: "Telegram"
  },
  {
    url: "https://web.whatsapp.com",
    regex: "^https://web\\.whatsapp\\.com/.*$",
    icon: "assets/logos/whatsapp-active.png",
    pattern: "https://web.whatsapp.com/*",
    siteName: "WhatsApp",
    customCss: true,
    version: "4.1.1"
  },
  {
    url: "https://github.com",
    regex: "^https://github\\.com/.*$",
    icon: "assets/logos/github-active.svg",
    pattern: "https://github.com/*",
    siteName: "GitHub"
  },
  {
    url: "https://www.goodreads.com",
    regex: "^https://www\\.goodreads\\.com/.*$",
    icon: "assets/logos/goodreads-active.svg",
    pattern: "https://www.goodreads.com/*",
    siteName: "Goodreads"
  },
  {
    url: "https://medium.com",
    regex: "^https://medium\\.com/.*$",
    icon: "assets/logos/medium-active.svg",
    pattern: "https://medium.com/*",
    siteName: "Medium"
  },
  {
    url: "https://messages.google.com",
    regex: "^https://messages\\.google\\.com/.*$",
    icon: "assets/logos/messagesandroid-active.svg",
    pattern: "https://messages.google.com/*",
    siteName: "Messages"
  },
  {
    url: "https://slack.com",
    regex: "^https://slack\\.com/.*$",
    icon: "assets/logos/slack-active.svg",
    pattern: "https://slack.com/*",
    siteName: "Slack"
  },
  {
    url: "https://www.dropbox.com",
    regex: "^https://www\\.[^/]*dropbox\\.com/.*$",
    icon: "assets/logos/dropbox-active.svg",
    pattern: "https://www.*dropbox.com/*",
    siteName: "Dropbox"
  },
  {
    url: "https://duckduckgo.com",
    regex: "^https://duckduckgo\\.com/.*$",
    icon: "assets/logos/duckduckgo-active.svg",
    pattern: "https://duckduckgo.com/*",
    siteName: "DuckDuckGo"
  },
  {
    url: "https://trello.com",
    regex: "^https://trello\\.com/.*$",
    icon: "assets/logos/trello-active.svg",
    pattern: "https://trello.com/*",
    siteName: "Trello"
  },
  {
    url: "https://www.wikipedia.org",
    regex: "^https://[^/]*\\.wikipedia\\.org/.*$",
    icon: "assets/logos/wikipedia-active.svg",
    pattern: "https://*.wikipedia.org/*",
    siteName: "Wikipedia"
  },
  {
    url: "https://wordpress.org",
    regex: "^https://([^/]*\\.)?wordpress\\.org/.*$",
    icon: "assets/logos/wordpress-active.svg",
    pattern: "https://*wordpress.org/*",
    siteName: "WordPress"
  },
  {
    url: "https://www.youtube.com",
    regex: "^https://www\\.youtube\\.com/.*$",
    icon: "assets/logos/youtube-active.svg",
    pattern: "https://www.youtube.com/*",
    siteName: "YouTube"
  }
]

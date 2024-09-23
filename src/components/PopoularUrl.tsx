import { useEffect, useState } from "react"
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

import { Storage } from "@plasmohq/storage"

interface BoxItem {
  id: string
  src: string
  isActive: boolean
  url: string
}

const storage = new Storage()

export const initialBoxes: BoxItem[] = [
  { id: "crisp", src: crisp, isActive: true, url: "" },
  {
    id: "dropbox",
    src: dropbox,
    isActive: true,
    url: "https://www.dropbox.com/*"
  },
  {
    id: "duckduckgo",
    src: duckduckgo,
    isActive: true,
    url: "https://duckduckgo.com/*"
  },
  {
    id: "facebook",
    src: facebook,
    isActive: true,
    url: "https://www.facebook.com/*"
  },
  { id: "feedly", src: feedly, isActive: true, url: "https://feedly.com/*" },
  {
    id: "getpocket",
    src: getpocket,
    isActive: true,
    url: "https://getpocket.com/*"
  },
  { id: "github", src: github, isActive: true, url: "https://github.com/*" },
  {
    id: "gmail",
    src: gmail,
    isActive: true,
    url: "https://mail.google.com/*"
  },
  {
    id: "goodreads",
    src: goodreads,
    isActive: true,
    url: "https://www.goodreads.com/*"
  },
  {
    id: "google",
    src: google,
    isActive: true,
    url: "https://www.google.com/*"
  },
  {
    id: "inoreader",
    src: inoreader,
    isActive: true,
    url: "https://www.inoreader.com/*"
  },
  {
    id: "instagram",
    src: instagram,
    isActive: true,
    url: "https://www.instagram.com/*"
  },
  {
    id: "linkedin",
    src: linkedin,
    isActive: true,
    url: "https://www.linkedin.com/*"
  },
  { id: "medium", src: medium, isActive: true, url: "https://medium.com/*" },
  {
    id: "messagesandroid",
    src: messagesandroid,
    isActive: true,
    url: "https://messages.google.com/*"
  },
  { id: "slack", src: slack, isActive: true, url: "https://slack.com/*" },
  {
    id: "telegram",
    src: telegram,
    isActive: true,
    url: "https://web.telegram.org/*"
  },
  { id: "trello", src: trello, isActive: true, url: "https://trello.com/*" },
  { id: "twitter", src: twitter, isActive: true, url: "https://x.com/*" },
  {
    id: "virgool",
    src: virgool,
    isActive: true,
    url: "https://virgool.io/*"
  },
  {
    id: "whatsapp",
    src: whatsapp,
    isActive: true,
    url: "https://web.whatsapp.com/*"
  },
  {
    id: "wikipedia",
    src: wikipedia,
    isActive: true,
    url: "https://*.wikipedia.org/*"
  },
  {
    id: "wordpress",
    src: wordpress,
    isActive: true,
    url: "https://*.wordpress.org/*"
  }
]
function PopularUrl() {
  const [boxes, setBoxes] = useState(initialBoxes)

  useEffect(() => {
    const initializeBoxes = async () => {
      // await storage.clear()
      const storedUrls = await storage.get<BoxItem[]>("activeUrls")
      if (storedUrls && storedUrls.length > 0) {
        setBoxes(storedUrls)
      } else {
        await storage.set("activeUrls", initialBoxes)
        setBoxes(initialBoxes)
      }
    }

    initializeBoxes()
  }, [])

  const toggleActive = async (id: string) => {
    const updatedBoxes = boxes.map((box) =>
      box.id === id ? { ...box, isActive: !box.isActive } : box
    )
    setBoxes(updatedBoxes)
    await storage.set("activeUrls", updatedBoxes)

    chrome.runtime.sendMessage({
      action: "updateActiveUrls",
      activeUrls: updatedBoxes
    })
  }

  return (
    <div className="my-4 grid grid-cols-5 gap-2 justify-items-center overflow-auto h-96">
      {boxes.map((box) => (
        <div
          key={box.id}
          className={`shadow-sm border border-gray-300 rounded-md size-12 flex items-center justify-center cursor-pointer hover:shadow-xl hover:grayscale ${
            box.isActive ? "" : "hover:grayscale "
          }`}
          onClick={() => toggleActive(box.id)}>
          <img
            src={box.src}
            alt={`${box.id} Logo`}
            className={`w-full h-full object-cover transition-all duration-300 ${
              box.isActive ? "" : "grayscale opacity-25"
            }`}
          />
        </div>
      ))}
    </div>
  )
}

export default PopularUrl

import aistudio from "../../assets/styles/aistudio.css"
import arena from "../../assets/styles/arena.css"
import chatgpt from "../../assets/styles/chatgpt.css"
import claude from "../../assets/styles/claude.css"
import copilot from "../../assets/styles/copilot.css"
import deepseek from "../../assets/styles/deepseek.css"
import duckduckgo from "../../assets/styles/duckduckgo.css"
import facebook from "../../assets/styles/facebook.css"
import gemini from "../../assets/styles/gemini.css"
import github from "../../assets/styles/github.css"
import gmail from "../../assets/styles/gmail.css"
import google from "../../assets/styles/google.css"
import instagram from "../../assets/styles/instagram.css"
import linkedin from "../../assets/styles/linkedin.css"
import notebooklm from "../../assets/styles/notebooklm.css"
import openrouter from "../../assets/styles/openrouter.css"
import perplexity from "../../assets/styles/perplexity.css"
import poe from "../../assets/styles/poe.css"
import qwen from "../../assets/styles/qwen.css"
import slack from "../../assets/styles/slack.css"
import telegram from "../../assets/styles/telegram.css"
import ticktick from "../../assets/styles/ticktick.css"
import trello from "../../assets/styles/trello.css"
import whatsapp from "../../assets/styles/whatsapp.css"
import wikipedia from "../../assets/styles/wikipedia.css"
import x from "../../assets/styles/x.css"
import youtube from "../../assets/styles/youtube.css"
import type { FontaraSiteActivationState } from "./site-manager"

export const CUSTOM_CSS_BY_SITE: Record<string, string> = {
  "https://aistudio.google.com": aistudio,
  "https://arena.ai": arena,
  "https://chatgpt.com": chatgpt,
  "https://claude.ai": claude,
  "https://copilot.microsoft.com": copilot,
  "https://chat.deepseek.com": deepseek,
  "https://duckduckgo.com": duckduckgo,
  "https://www.facebook.com": facebook,
  "https://gemini.google.com": gemini,
  "https://github.com": github,
  "https://mail.google.com": gmail,
  "https://www.google.com": google,
  "https://www.instagram.com": instagram,
  "https://www.linkedin.com": linkedin,
  "https://notebooklm.google.com": notebooklm,
  "https://openrouter.ai": openrouter,
  "https://www.perplexity.ai": perplexity,
  "https://poe.com": poe,
  "https://chat.qwen.ai": qwen,
  "https://app.slack.com": slack,
  "https://web.telegram.org": telegram,
  "https://ticktick.com": ticktick,
  "https://trello.com": trello,
  "https://web.whatsapp.com": whatsapp,
  "https://www.wikipedia.org": wikipedia,
  "https://www.youtube.com": youtube,
  "https://x.com": x
}

export function getCustomCSSForSite(
  activationState: FontaraSiteActivationState
): string | null {
  if (
    !activationState.matchingWebsite?.customCss ||
    !activationState.matchingWebsite.url
  ) {
    return null
  }

  return CUSTOM_CSS_BY_SITE[activationState.matchingWebsite.url] ?? null
}

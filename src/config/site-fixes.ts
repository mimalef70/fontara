import chatgpt from "../../assets/styles/chatgpt.css"
import gemini from "../../assets/styles/gemini.css"
import gmail from "../../assets/styles/gmail.css"
import google from "../../assets/styles/google.css"
import linkedin from "../../assets/styles/linkedin.css"
import whatsapp from "../../assets/styles/whatsapp.css"
import x from "../../assets/styles/x.css"

export const CUSTOM_CSS_BY_SITE: Record<string, string> = {
  "https://chatgpt.com": chatgpt,
  "https://gemini.google.com": gemini,
  "https://mail.google.com": gmail,
  "https://www.google.com": google,
  "https://www.linkedin.com": linkedin,
  "https://web.whatsapp.com": whatsapp,
  "https://x.com": x
}

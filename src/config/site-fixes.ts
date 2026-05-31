// @ts-expect-error esbuild loads text assets through the ?text suffix.
import whatsapp from "../../assets/styles/whatsapp.css?text"

export const CUSTOM_CSS_BY_SITE: Record<string, string> = {
  "https://web.whatsapp.com": whatsapp
}

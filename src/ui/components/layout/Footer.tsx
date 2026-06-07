import { STORAGE_KEYS } from "../../../config/storage"
import { cn } from "../../../utils/cn"
import { useStorageValue } from "../../hooks/use-storage"
import { useI18n } from "../../i18n"
import { getExtensionEnabledInitialValue } from "../../storage-defaults"
import { HeartBold } from "../icons"

function Footer() {
  const { direction, t } = useI18n()
  const [extensionActive] = useStorageValue<boolean>(
    STORAGE_KEYS.EXTENSION_ENABLED,
    getExtensionEnabledInitialValue
  )

  return (
    <div
      className={cn("transition-opacity duration-200 p-4", {
        "opacity-30": !extensionActive,
        "opacity-100": extensionActive
      })}>
      <footer className="w-full flex flex-col gap-2 items-center justify-center">
        <p
          className="flex max-w-full items-center justify-center gap-1 whitespace-nowrap text-center text-[11px] leading-5 text-gray-500"
          dir={direction}>
          <span className="font-medium">{t("footer.designedBeforeHeart")}</span>
          <HeartBold className="size-4 shrink-0 text-[#ff0000]" />
          <span className="font-medium">{t("footer.designedAfterHeart")}</span>
          <a
            href="https://www.linkedin.com/in/mostafaalahyari/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-black text-gray-700 cursor-pointer">
            {t("footer.authorName")}
          </a>
        </p>
        <div className="flex items-center justify-center gap-2">
          {/* <a
            href="https://mu.chat"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center">
            <img src={muchatLogo} alt="muchat" className="h-3" />
          </a> */}
          <span className="mt-2 mb-1 text-center text-xs text-gray-500">
            {t("footer.sponsoredBy")}{" "}
            <a
              href="https://mu.chat"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 font-bold">
              mu.chat
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}

export default Footer

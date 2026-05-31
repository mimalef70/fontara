import React from "react"

import { STORAGE_KEYS } from "../../../config/storage"
import { cn } from "../../../utils/cn"
import { useStorageValue } from "../../hooks/use-storage"
import { HeartBold } from "../icons"

function Footer() {
  const [extensionActive] = useStorageValue<boolean>(
    STORAGE_KEYS.EXTENSION_ENABLED,
    (value) => value !== false
  )

  return (
    <div
      className={cn("transition-opacity duration-200 p-4", {
        "opacity-30": !extensionActive,
        "opacity-100": extensionActive
      })}>
      <footer className="w-full flex flex-col gap-2 items-center justify-center">
        <p className="flex justify-center items-center text-gray-500 gap-1">
          <span className="font-medium flex items-center gap-1">
            {" "}
            طراحی و توسعه با <HeartBold className="size-4 text-[#ff0000]" />{" "}
            توسط{" "}
          </span>
          <a
            onClick={() => {
              window.open("https://www.linkedin.com/in/mostafaalahyari/", "_blank")
            }}
            className="font-black text-gray-700 cursor-pointer">
            مصطفی الهیاری
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
          <span className="text-gray-500 mt-2 mb-1">
            Sponsored by{" "}
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

import React from "react"

type Props = {
  isActive: boolean
}

function Footer({ isActive }: Props) {
  return (
    <div
      className={`${isActive ? "opacity-30" : "opacity-100"} transition-opacity duration-200 p-4`}>
      <footer className="w-full">
        <p className="flex justify-center items-center text-gray-500 gap-1">
          <span className="font-medium"> طراحی و توسعه با 💖 توسط </span>
          <a
            href="https://x.com/mimalef70"
            className="font-black text-gray-700">
            مصطفی الهیاری
          </a>
        </p>
      </footer>
    </div>
  )
}

export default Footer

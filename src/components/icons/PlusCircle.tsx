import * as React from "react"
import type { SVGProps } from "react"

const SvgPlusCircle = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    fill="none"
    viewBox="0 0 24 24"
    {...props}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18"
      clipRule="evenodd"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M15.299 12.002h-6.6M12 8.704v6.593"
    />
  </svg>
)
export default SvgPlusCircle

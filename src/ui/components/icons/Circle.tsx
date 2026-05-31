import * as React from "react"
import type { SVGProps } from "react"

const SvgCircle = (props: SVGProps<SVGSVGElement>) => (
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
      d="M12 3.001a9 9 0 1 1 0 18 9 9 0 0 1 0-18"
      clipRule="evenodd"
    />
  </svg>
)
export default SvgCircle

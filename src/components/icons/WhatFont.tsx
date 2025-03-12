import * as React from "react"
import type { SVGProps } from "react"

const SvgWhatFont = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    fill="none"
    viewBox="0 0 25 25"
    {...props}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M14.986 8.277c0-3.505 5.515-3.505 5.515 0 0 2.515-2.507 2.006-2.507 5.02M14.227 19.883 9.364 8.75 4.5 19.883M6.24 15.902h6.249M17.995 16.345v.064m.259-.05a.26.26 0 1 1-.522 0 .26.26 0 0 1 .522 0"
    />
  </svg>
)
export default SvgWhatFont

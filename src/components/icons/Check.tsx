import * as React from "react"
import type { SVGProps } from "react"

const SvgCheck = (props: SVGProps<SVGSVGElement>) => (
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
      d="m19 7.188-9.625 9.625L5 12.438"
    />
  </svg>
)
export default SvgCheck

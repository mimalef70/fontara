import { cn } from "../../../utils/cn"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-primary/10 motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

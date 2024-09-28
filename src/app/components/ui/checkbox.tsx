import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className="flex items-center space-x-2 cursor-pointer">
        <input
          type="checkbox"
          className={cn(
            "form-checkbox h-4 w-4 text-purple-600 transition duration-150 ease-in-out",
            "border border-gray-300 rounded",
            "focus:ring-2 focus:ring-purple-500 focus:outline-none",
            className
          )}
          ref={ref}
          {...props}
        />
        {label && <span className="text-sm text-gray-700">{label}</span>}
      </label>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
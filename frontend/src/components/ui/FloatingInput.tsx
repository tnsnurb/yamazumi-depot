import * as React from "react"
import { cn } from "@/lib/utils"

export interface FloatingInputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    containerClassName?: string;
    labelClassName?: string;
    error?: boolean;
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
    ({ className, type, label, containerClassName, labelClassName, error, ...props }, ref) => {
        return (
            <div className={cn("floating-label-group group relative mt-2 w-full", error && "error", containerClassName)}>
                <input
                    type={type}
                    className={cn(
                        "peer block w-full px-3 py-2.5 text-sm bg-transparent border border-gray-300 rounded-lg appearance-none focus:outline-none focus:ring-0 focus:border-indigo-600 dark:border-gray-600 dark:focus:border-indigo-500 transition-colors placeholder:opacity-0 focus:placeholder:opacity-100 dark:text-white",
                        className
                    )}
                    placeholder={props.placeholder || " "}
                    ref={ref}
                    {...props}
                />
                <label className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 duration-200 transition-all pointer-events-none z-10 origin-left px-1",
                    "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:scale-75 peer-focus:text-indigo-600 peer-focus:dark:text-indigo-400 peer-focus:bg-white peer-focus:dark:bg-gray-900 peer-focus:font-medium",
                    "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:scale-75 peer-[:not(:placeholder-shown)]:bg-white peer-[:not(:placeholder-shown)]:dark:bg-gray-900 peer-[:not(:placeholder-shown)]:font-medium",
                    labelClassName
                )}>
                    {label}
                </label>
            </div>
        )
    }
)
FloatingInput.displayName = "FloatingInput"

export { FloatingInput }

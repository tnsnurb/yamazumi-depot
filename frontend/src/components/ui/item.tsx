import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const itemVariants = cva(
    "group/item relative flex items-center gap-3 transition-colors",
    {
        variants: {
            variant: {
                default: "hover:bg-accent/50",
                outline: "border rounded-lg p-3 hover:bg-accent/50",
                muted: "bg-muted/30 hover:bg-muted/50 rounded-lg p-3",
            },
            size: {
                default: "min-h-[64px] p-4",
                sm: "min-h-[48px] p-3 text-sm",
                xs: "min-h-[40px] p-2 text-xs",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ItemProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof itemVariants> {
    asChild?: boolean
}

const Item = React.forwardRef<HTMLDivElement, ItemProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "div"
        return (
            <Comp
                ref={ref}
                className={cn(itemVariants({ variant, size, className }))}
                {...props}
            />
        )
    }
)
Item.displayName = "Item"

const ItemGroup = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-1", className)} {...props} />
))
ItemGroup.displayName = "ItemGroup"

const ItemMedia = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        variant?: "default" | "icon" | "image" | "avatar"
    }
>(({ className, variant = "default", ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "flex shrink-0 items-center justify-center",
            variant === "icon" && "size-10 rounded-lg bg-accent text-accent-foreground",
            variant === "avatar" && "size-10 rounded-full",
            variant === "image" && "aspect-square size-12 rounded-lg object-cover",
            className
        )}
        {...props}
    />
))
ItemMedia.displayName = "ItemMedia"

const ItemContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-1 flex-col justify-center min-w-0 px-2", className)}
        {...props}
    />
))
ItemContent.displayName = "ItemContent"

const ItemTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "text-sm font-semibold leading-tight tracking-tight truncate",
            className
        )}
        {...props}
    />
))
ItemTitle.displayName = "ItemTitle"

const ItemDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-[0.8rem] text-muted-foreground line-clamp-2", className)}
        {...props}
    />
))
ItemDescription.displayName = "ItemDescription"

const ItemActions = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center gap-2 ml-auto", className)}
        {...props}
    />
))
ItemActions.displayName = "ItemActions"

const ItemHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("mb-1 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground", className)}
        {...props}
    />
))
ItemHeader.displayName = "ItemHeader"

const ItemFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("mt-2 flex items-center gap-2", className)}
        {...props}
    />
))
ItemFooter.displayName = "ItemFooter"

const ItemSeparator = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("h-px bg-border mx-4", className)}
        {...props}
    />
))
ItemSeparator.displayName = "ItemSeparator"

export {
    Item,
    ItemGroup,
    ItemMedia,
    ItemContent,
    ItemTitle,
    ItemDescription,
    ItemActions,
    ItemHeader,
    ItemFooter,
    ItemSeparator,
}

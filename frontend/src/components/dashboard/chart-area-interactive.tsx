"use client"


import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import type {
    ChartConfig
} from "@/components/ui/chart"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"

const chartConfig = {
    count: {
        label: "Перемещений",
        color: "hsl(var(--primary))",
    },
} satisfies ChartConfig

interface ChartAreaInteractiveProps {
    data: { date: string; label: string; count: number }[] | undefined
}

export function ChartAreaInteractive({ data }: ChartAreaInteractiveProps) {
    if (!data) return null

    return (
        <Card className="px-4 lg:px-6 border-none shadow-none bg-transparent">
            <CardHeader className="px-0">
                <CardTitle>Динамика перемещений</CardTitle>
                <CardDescription>
                    Количество перемещений локомотивов за последние 30 дней
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
                    <AreaChart
                        data={data}
                        margin={{
                            left: 12,
                            right: 12,
                        }}
                    >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value, index) => index % 5 === 0 ? value : ''}
                            className="text-[10px] md:text-xs"
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            className="text-[10px] md:text-xs"
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" />}
                        />
                        <Area
                            dataKey="count"
                            type="natural"
                            fill="var(--color-count)"
                            fillOpacity={0.1}
                            stroke="var(--color-count)"
                            strokeWidth={2}
                            stackId="a"
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

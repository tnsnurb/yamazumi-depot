import { useState, useEffect } from "react";

interface TimeCounterProps {
    date: string | null;
    variant?: "days" | "hours";
    className?: string;
}

export const TimeCounter = ({ date, variant = "days", className }: TimeCounterProps) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    if (!date) return null;

    const diff = currentTime.getTime() - new Date(date).getTime();
    
    if (variant === "hours") {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        return <span className={className}>{hours > 0 ? hours : 0} ч</span>;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return (
        <p className={className}>На пути: {days === 0 ? 'сегодня' : `${days} дн.`}</p>
    );
};

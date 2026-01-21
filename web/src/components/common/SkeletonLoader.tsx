import React from 'react'

interface SkeletonProps {
    className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
    return (
        <div
            className={`animate-pulse bg-[var(--color-bg-elevated)] rounded-md ${className}`}
        />
    )
}

export const StatsSkeleton: React.FC = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)] h-24">
                    <Skeleton className="w-1/3 h-4 mb-2" />
                    <Skeleton className="w-1/2 h-8" />
                </div>
            ))}
        </div>
    )
}

export const ChatListSkeleton: React.FC = () => {
    return (
        <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="w-1/3 h-4" />
                        <Skeleton className="w-2/3 h-3" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export const MessageSkeleton: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-start">
                <Skeleton className="w-64 h-20 rounded-xl rounded-tl-none" />
            </div>
            <div className="flex justify-end">
                <Skeleton className="w-48 h-12 rounded-xl rounded-tr-none" />
            </div>
            <div className="flex justify-start">
                <Skeleton className="w-80 h-32 rounded-xl rounded-tl-none" />
            </div>
            <div className="flex justify-end">
                <Skeleton className="w-32 h-10 rounded-xl rounded-tr-none" />
            </div>
        </div>
    )
}

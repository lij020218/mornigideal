"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, Circle, Link as LinkIcon, FileText, Lightbulb, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChecklistItem {
    id: string;
    text: string;
    completed?: boolean;
}

interface ResourceLink {
    title: string;
    url: string;
    description?: string;
}

interface FieriResource {
    id: string;
    resourceType: 'checklist' | 'links' | 'briefing' | 'suggestion';
    title: string;
    content: {
        items?: ChecklistItem[];
        links?: ResourceLink[];
        text?: string;
    };
    relatedScheduleId?: string;
    createdAt: Date;
}

interface FieriResourceViewerProps {
    resources: FieriResource[];
    onChecklistItemToggle?: (resourceId: string, itemId: string, completed: boolean) => void;
    onDismiss?: (resourceId: string) => void;
}

export function FieriResourceViewer({
    resources,
    onChecklistItemToggle,
    onDismiss
}: FieriResourceViewerProps) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(resources.map(r => r.id)));

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    if (resources.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            {resources.map((resource) => (
                <FieriResourceCard
                    key={resource.id}
                    resource={resource}
                    isExpanded={expandedIds.has(resource.id)}
                    onToggleExpand={() => toggleExpand(resource.id)}
                    onChecklistItemToggle={onChecklistItemToggle}
                    onDismiss={onDismiss}
                />
            ))}
        </div>
    );
}

interface FieriResourceCardProps {
    resource: FieriResource;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onChecklistItemToggle?: (resourceId: string, itemId: string, completed: boolean) => void;
    onDismiss?: (resourceId: string) => void;
}

function FieriResourceCard({
    resource,
    isExpanded,
    onToggleExpand,
    onChecklistItemToggle,
    onDismiss
}: FieriResourceCardProps) {
    const icon = getResourceIcon(resource.resourceType);
    const IconComponent = icon.component;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className={cn(
                "rounded-2xl p-4 shadow-md",
                "bg-gradient-to-br from-indigo-50/90 to-purple-50/90",
                "dark:from-indigo-950/30 dark:to-purple-950/30",
                "border-2 border-indigo-200/50 dark:border-indigo-800/50",
                "backdrop-blur-sm"
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <button
                    onClick={onToggleExpand}
                    className="flex items-center gap-3 flex-1 text-left group"
                >
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        "bg-gradient-to-br",
                        icon.gradient
                    )}>
                        <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-sm text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                            {resource.title}
                            <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ChevronDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            </motion.div>
                        </h3>
                        <p className="text-xs text-indigo-700/70 dark:text-indigo-300/70 mt-1">
                            Fi.eri가 준비했어요 • {formatTimeAgo(resource.createdAt)}
                        </p>
                    </div>
                </button>
                {onDismiss && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDismiss(resource.id)}
                        className="h-7 w-7 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100/50 dark:text-indigo-400 dark:hover:text-indigo-200 dark:hover:bg-indigo-900/30 rounded-full"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-2 border-t border-indigo-200/30 dark:border-indigo-800/30">
                            {resource.resourceType === 'checklist' && resource.content.items && (
                                <ChecklistContent
                                    items={resource.content.items}
                                    resourceId={resource.id}
                                    onItemToggle={onChecklistItemToggle}
                                />
                            )}
                            {resource.resourceType === 'links' && resource.content.links && (
                                <LinksContent links={resource.content.links} />
                            )}
                            {(resource.resourceType === 'briefing' || resource.resourceType === 'suggestion') && resource.content.text && (
                                <TextContent text={resource.content.text} />
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// Checklist Content
function ChecklistContent({
    items,
    resourceId,
    onItemToggle
}: {
    items: ChecklistItem[];
    resourceId: string;
    onItemToggle?: (resourceId: string, itemId: string, completed: boolean) => void;
}) {
    return (
        <div className="space-y-2">
            {items.map((item) => (
                <motion.button
                    key={item.id}
                    onClick={() => onItemToggle?.(resourceId, item.id, !item.completed)}
                    className={cn(
                        "w-full flex items-start gap-3 p-2 rounded-lg",
                        "hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30",
                        "transition-colors text-left group"
                    )}
                    whileTap={{ scale: 0.98 }}
                >
                    {item.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                    ) : (
                        <Circle className="w-5 h-5 text-indigo-400 dark:text-indigo-600 flex-shrink-0 mt-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                    )}
                    <span className={cn(
                        "text-sm flex-1",
                        item.completed
                            ? "text-indigo-600/60 dark:text-indigo-400/60 line-through"
                            : "text-indigo-900 dark:text-indigo-100"
                    )}>
                        {item.text}
                    </span>
                </motion.button>
            ))}
        </div>
    );
}

// Links Content
function LinksContent({ links }: { links: ResourceLink[] }) {
    return (
        <div className="space-y-2">
            {links.map((link, index) => (
                <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                        "flex items-start gap-3 p-3 rounded-lg",
                        "bg-white/50 dark:bg-gray-900/50",
                        "border border-indigo-200/50 dark:border-indigo-800/50",
                        "hover:border-indigo-300 dark:hover:border-indigo-700",
                        "hover:shadow-md transition-all duration-200",
                        "group"
                    )}
                >
                    <LinkIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                            {link.title}
                        </p>
                        {link.description && (
                            <p className="text-xs text-indigo-700/70 dark:text-indigo-300/70 mt-1">
                                {link.description}
                            </p>
                        )}
                    </div>
                </a>
            ))}
        </div>
    );
}

// Text Content
function TextContent({ text }: { text: string }) {
    return (
        <div className="p-3 rounded-lg bg-white/30 dark:bg-gray-900/30">
            <p className="text-sm text-indigo-900 dark:text-indigo-100 leading-relaxed whitespace-pre-wrap">
                {text}
            </p>
        </div>
    );
}

// Helper: Get resource icon
function getResourceIcon(type: string) {
    switch (type) {
        case 'checklist':
            return { component: CheckCircle2, gradient: "from-green-500 to-emerald-600" };
        case 'links':
            return { component: LinkIcon, gradient: "from-blue-500 to-indigo-600" };
        case 'briefing':
            return { component: FileText, gradient: "from-purple-500 to-indigo-600" };
        case 'suggestion':
            return { component: Lightbulb, gradient: "from-amber-500 to-orange-600" };
        default:
            return { component: Sparkles, gradient: "from-indigo-500 to-purple-600" };
    }
}

// Helper: Format time ago
function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "방금";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    return `${Math.floor(diffInSeconds / 86400)}일 전`;
}

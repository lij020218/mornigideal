"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";

// Settings Sections Component
export const SettingsSection = ({ title, description, icon: Icon, children }: {
    title: string;
    description?: string;
    icon?: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}) => (
    <div className="space-y-4">
        <div className="flex items-center gap-3">
            {Icon && (
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                </div>
            )}
            <div>
                <h3 className="font-semibold text-lg">{title}</h3>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
        </div>
        <div className="space-y-4 pl-0 md:pl-13">{children}</div>
    </div>
);

// Settings Row Component
export const SettingsRow = ({ label, description, children, badge }: {
    label: string;
    description?: string;
    children: React.ReactNode;
    badge?: string;
}) => (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
        <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
                <span className="font-medium">{label}</span>
                {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
            </div>
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <div className="flex-shrink-0">{children}</div>
    </div>
);

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { FieriSuggestionCard } from "./FieriSuggestionCard";
import { FieriConfirmationDialog } from "./FieriConfirmationDialog";
import { FieriResourceViewer } from "./FieriResourceViewer";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
    id: string;
    type: string;
    message: string;
    action_type?: string;
    action_payload?: Record<string, any>;
    created_at: string;
}

interface Confirmation {
    id: string;
    message: string;
    action_type: string;
    action_payload: Record<string, any>;
    status: string;
    created_at: string;
}

interface Resource {
    id: string;
    resource_type: 'checklist' | 'links' | 'briefing' | 'suggestion';
    title: string;
    content: any;
    related_schedule_id?: string;
    created_at: string;
}

interface FieriInterventionsContainerProps {
    className?: string;
}

export function FieriInterventionsContainer({ className }: FieriInterventionsContainerProps) {
    const { data: session } = useSession();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Initial fetch and polling
    useEffect(() => {
        if (!session?.user?.email) return;

        const userEmail = session.user.email;

        const fetchInterventions = async () => {
            try {
                const response = await fetch(`/api/fieri/interventions?email=${encodeURIComponent(userEmail)}`);
                if (!response.ok) {
                    console.error('Failed to fetch interventions');
                    return;
                }

                const data = await response.json();
                setNotifications(data.notifications || []);
                setConfirmations(data.confirmations || []);
                setResources(data.resources || []);
            } catch (error) {
                console.error('Error fetching interventions:', error);
            }
        };

        // Initial fetch
        fetchInterventions();

        // Poll every 30 seconds for new interventions
        const interval = setInterval(fetchInterventions, 30000);

        return () => clearInterval(interval);
    }, [session?.user?.email]);

    // Handle notification accept
    const handleNotificationAccept = async (id: string) => {
        if (!session?.user?.email) return;

        const notification = notifications.find(n => n.id === id);
        if (!notification) return;

        // TODO: Execute the action based on action_type

        // Dismiss notification (this will update local state)
        await handleNotificationDismiss(id);
    };

    // Handle notification dismiss
    const handleNotificationDismiss = async (id: string) => {
        if (!session?.user?.email) return;

        try {
            const response = await fetch('/api/fieri/interventions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'dismiss_notification',
                    userEmail: session.user.email,
                    id
                })
            });

            if (response.ok) {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }
        } catch (error) {
            console.error('Error dismissing notification:', error);
        }
    };

    // Handle confirmation accept
    const handleConfirmationAccept = async (id: string) => {
        if (!session?.user?.email) return;

        try {
            const response = await fetch('/api/fieri/interventions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'accept_confirmation',
                    userEmail: session.user.email,
                    id
                })
            });

            if (response.ok) {
                setConfirmations(prev => prev.filter(c => c.id !== id));
                // TODO: Execute the actual action
            }
        } catch (error) {
            console.error('Error accepting confirmation:', error);
        }
    };

    // Handle confirmation reject
    const handleConfirmationReject = async (id: string) => {
        if (!session?.user?.email) return;

        try {
            const response = await fetch('/api/fieri/interventions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'reject_confirmation',
                    userEmail: session.user.email,
                    id
                })
            });

            if (response.ok) {
                setConfirmations(prev => prev.filter(c => c.id !== id));
            }
        } catch (error) {
            console.error('Error rejecting confirmation:', error);
        }
    };

    // Handle checklist item toggle
    const handleChecklistItemToggle = async (resourceId: string, itemId: string, completed: boolean) => {
        if (!session?.user?.email) return;

        try {
            const response = await fetch('/api/fieri/interventions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'toggle_checklist_item',
                    userEmail: session.user.email,
                    id: resourceId,
                    itemId,
                    completed
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Update local state
                setResources(prev => prev.map(r =>
                    r.id === resourceId ? { ...r, content: data.content } : r
                ));
            }
        } catch (error) {
            console.error('Error toggling checklist item:', error);
        }
    };

    // Handle resource dismiss
    const handleResourceDismiss = async (resourceId: string) => {
        if (!session?.user?.email) return;

        try {
            const response = await fetch('/api/fieri/interventions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'complete_resource',
                    userEmail: session.user.email,
                    id: resourceId
                })
            });

            if (response.ok) {
                setResources(prev => prev.filter(r => r.id !== resourceId));
            }
        } catch (error) {
            console.error('Error dismissing resource:', error);
        }
    };

    const hasInterventions = notifications.length > 0 || resources.length > 0;

    return (
        <>
            {/* Notifications & Resources */}
            <AnimatePresence>
                {hasInterventions && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={className}
                    >
                        <div className="space-y-3">
                            {/* Notifications (L2 suggestions) */}
                            {notifications.map(notification => (
                                <FieriSuggestionCard
                                    key={notification.id}
                                    id={notification.id}
                                    message={notification.message}
                                    actionType={notification.action_type}
                                    actionPayload={notification.action_payload}
                                    createdAt={new Date(notification.created_at)}
                                    onAccept={handleNotificationAccept}
                                    onDismiss={handleNotificationDismiss}
                                />
                            ))}

                            {/* Resources */}
                            {resources.length > 0 && (
                                <FieriResourceViewer
                                    resources={resources.map(r => ({
                                        ...r,
                                        resourceType: r.resource_type,
                                        relatedScheduleId: r.related_schedule_id,
                                        createdAt: new Date(r.created_at)
                                    }))}
                                    onChecklistItemToggle={handleChecklistItemToggle}
                                    onDismiss={handleResourceDismiss}
                                />
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirmation Dialog (L3) - Only show one at a time */}
            {confirmations.length > 0 && (
                <FieriConfirmationDialog
                    id={confirmations[0].id}
                    message={confirmations[0].message}
                    actionType={confirmations[0].action_type}
                    actionPayload={confirmations[0].action_payload}
                    onAccept={handleConfirmationAccept}
                    onReject={handleConfirmationReject}
                    isOpen={true}
                />
            )}
        </>
    );
}

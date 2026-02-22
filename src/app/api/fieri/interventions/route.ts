/**
 * Fi.eri Interventions API
 * Fetch user's Fi.eri notifications, confirmations, and resources
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserEmailWithAuth } from '@/lib/auth-utils';
import { Hands } from '@/lib/jarvis/hands';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Fetch notifications (L2 soft suggestions)
        const { data: notifications, error: notifError } = await supabaseAdmin
            .from('jarvis_notifications')
            .select('*')
            .eq('user_email', userEmail)
            .is('dismissed_at', null)
            .order('created_at', { ascending: false })
            .limit(10);

        if (notifError) {
            console.error('[Interventions API] Failed to fetch notifications:', notifError);
        }

        // Fetch confirmation requests (L3 direct actions)
        const { data: confirmations, error: confirmError } = await supabaseAdmin
            .from('jarvis_confirmation_requests')
            .select('*')
            .eq('user_email', userEmail)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5);

        if (confirmError) {
            console.error('[Interventions API] Failed to fetch confirmations:', confirmError);
        }

        // Fetch resources (checklists, links, etc.)
        const { data: resources, error: resourcesError } = await supabaseAdmin
            .from('jarvis_resources')
            .select('*')
            .eq('user_email', userEmail)
            .is('completed_at', null)
            .order('created_at', { ascending: false })
            .limit(10);

        if (resourcesError) {
            console.error('[Interventions API] Failed to fetch resources:', resourcesError);
        }

        return NextResponse.json({
            notifications: notifications || [],
            confirmations: confirmations || [],
            resources: resources || []
        });
    } catch (error) {
        console.error('[Interventions API] Exception:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const userEmail = await getUserEmailWithAuth(request);
        if (!userEmail) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { action, id } = body;

        if (!id || !action) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        if (action === 'dismiss_notification') {
            const { error } = await supabaseAdmin
                .from('jarvis_notifications')
                .update({ dismissed_at: new Date().toISOString() })
                .eq('id', id)
                .eq('user_email', userEmail);

            if (error) {
                console.error('[Interventions API] Failed to dismiss notification:', error);
                return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        if (action === 'accept_confirmation') {
            const { error } = await supabaseAdmin
                .from('jarvis_confirmation_requests')
                .update({
                    status: 'accepted',
                    responded_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('user_email', userEmail);

            if (error) {
                console.error('[Interventions API] Failed to accept confirmation:', error);
                return NextResponse.json({ error: 'Failed to accept' }, { status: 500 });
            }

            // TODO: Execute the actual action based on action_type and action_payload
            // This should be handled by the Hands module

            return NextResponse.json({ success: true });
        }

        if (action === 'reject_confirmation') {
            const { error } = await supabaseAdmin
                .from('jarvis_confirmation_requests')
                .update({
                    status: 'rejected',
                    responded_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('user_email', userEmail);

            if (error) {
                console.error('[Interventions API] Failed to reject confirmation:', error);
                return NextResponse.json({ error: 'Failed to reject' }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        if (action === 'mark_resource_accessed') {
            const { error } = await supabaseAdmin
                .from('jarvis_resources')
                .update({ accessed_at: new Date().toISOString() })
                .eq('id', id)
                .eq('user_email', userEmail);

            if (error) {
                console.error('[Interventions API] Failed to mark resource accessed:', error);
                return NextResponse.json({ error: 'Failed to mark accessed' }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        if (action === 'complete_resource') {
            const { error } = await supabaseAdmin
                .from('jarvis_resources')
                .update({ completed_at: new Date().toISOString() })
                .eq('id', id)
                .eq('user_email', userEmail);

            if (error) {
                console.error('[Interventions API] Failed to complete resource:', error);
                return NextResponse.json({ error: 'Failed to complete' }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        if (action === 'toggle_checklist_item') {
            const { itemId, completed } = body;

            if (!itemId) {
                return NextResponse.json({ error: 'itemId required' }, { status: 400 });
            }

            // Fetch current resource
            const { data: resource, error: fetchError } = await supabaseAdmin
                .from('jarvis_resources')
                .select('content')
                .eq('id', id)
                .eq('user_email', userEmail)
                .maybeSingle();

            if (fetchError || !resource) {
                return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
            }

            // Update checklist item
            const content = resource.content as any;
            if (content.items) {
                content.items = content.items.map((item: any) =>
                    item.id === itemId ? { ...item, completed } : item
                );

                const { error: updateError } = await supabaseAdmin
                    .from('jarvis_resources')
                    .update({ content })
                    .eq('id', id)
                    .eq('user_email', userEmail);

                if (updateError) {
                    console.error('[Interventions API] Failed to update checklist:', updateError);
                    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
                }

                return NextResponse.json({ success: true, content });
            }

            return NextResponse.json({ error: 'Not a checklist' }, { status: 400 });
        }

        if (action === 'undo_auto_action') {
            const { interventionLogId } = body;
            if (!interventionLogId) {
                return NextResponse.json({ error: 'interventionLogId required' }, { status: 400 });
            }
            const hands = new Hands(userEmail);
            const result = await hands.rollbackAction(interventionLogId);
            return NextResponse.json(result, { status: result.success ? 200 : 400 });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('[Interventions API] Exception:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

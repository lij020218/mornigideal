"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Eye, EyeOff, Check, X, Loader2, Trash2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AIProvider = 'openai' | 'anthropic' | 'google';

interface ProviderConfig {
    id: AIProvider;
    name: string;
    description: string;
    placeholder: string;
    docsUrl: string;
    color: string;
    icon: string;
}

const PROVIDERS: ProviderConfig[] = [
    {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT-4o, GPT-4o-mini 사용',
        placeholder: 'sk-...',
        docsUrl: 'https://platform.openai.com/api-keys',
        color: 'bg-emerald-500',
        icon: '🤖'
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Claude Opus, Sonnet, Haiku 사용',
        placeholder: 'sk-ant-...',
        docsUrl: 'https://console.anthropic.com/settings/keys',
        color: 'bg-orange-500',
        icon: '🧠'
    },
    {
        id: 'google',
        name: 'Google AI',
        description: 'Gemini Flash, Pro 사용',
        placeholder: 'AIza...',
        docsUrl: 'https://aistudio.google.com/app/apikey',
        color: 'bg-blue-500',
        icon: '✨'
    }
];

interface KeyStatus {
    masked: string;
    hasKey: boolean;
}

export function APIKeySettings() {
    const [keys, setKeys] = useState<Record<string, KeyStatus>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
    const [newKey, setNewKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // 키 상태 로드
    useEffect(() => {
        fetchKeys();
    }, []);

    const fetchKeys = async () => {
        try {
            const res = await fetch('/api/user/api-keys');
            if (res.ok) {
                const data = await res.json();
                setKeys(data.keys || {});
            }
        } catch (err) {
            console.error('Failed to fetch API keys:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveKey = async (provider: AIProvider) => {
        if (!newKey.trim()) {
            setError('API 키를 입력해주세요');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const res = await fetch('/api/user/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, key: newKey })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || '키 저장에 실패했습니다');
                return;
            }

            setKeys(prev => ({
                ...prev,
                [provider]: { masked: data.masked, hasKey: true }
            }));
            setSuccess(`${PROVIDERS.find(p => p.id === provider)?.name} API 키가 저장되었습니다`);
            setEditingProvider(null);
            setNewKey('');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.message || '오류가 발생했습니다');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteKey = async (provider: AIProvider) => {
        if (!confirm('이 API 키를 삭제하시겠습니까?')) return;

        try {
            const res = await fetch('/api/user/api-keys', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider })
            });

            if (res.ok) {
                setKeys(prev => ({
                    ...prev,
                    [provider]: { masked: '', hasKey: false }
                }));
                setSuccess('API 키가 삭제되었습니다');
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err) {
            console.error('Failed to delete key:', err);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                    <Key className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900">나만의 API 키 사용 (BYOK)</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        자신의 API 키를 등록하면 앱의 사용량 제한 없이 AI를 사용할 수 있습니다.
                        비용은 각 제공자에게 직접 청구됩니다.
                    </p>
                </div>
            </div>

            {/* 성공/에러 메시지 */}
            <AnimatePresence>
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700"
                    >
                        <Check className="w-4 h-4" />
                        <span className="text-sm">{success}</span>
                    </motion.div>
                )}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700"
                    >
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto">
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 제공자 목록 */}
            <div className="space-y-4">
                {PROVIDERS.map(provider => {
                    const keyStatus = keys[provider.id];
                    const isEditing = editingProvider === provider.id;

                    return (
                        <div
                            key={provider.id}
                            className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-lg ${provider.color} flex items-center justify-center text-xl`}>
                                        {provider.icon}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-gray-900">{provider.name}</h4>
                                            {keyStatus?.hasKey && (
                                                <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                                                    연결됨
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500">{provider.description}</p>
                                    </div>
                                </div>

                                <a
                                    href={provider.docsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                    키 발급
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>

                            {/* 키 상태 또는 입력 폼 */}
                            <div className="mt-4">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Input
                                                type={showKey ? 'text' : 'password'}
                                                value={newKey}
                                                onChange={(e) => setNewKey(e.target.value)}
                                                placeholder={provider.placeholder}
                                                className="pr-10 font-mono text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowKey(!showKey)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => handleSaveKey(provider.id)}
                                                disabled={isSaving}
                                            >
                                                {isSaving ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Check className="w-4 h-4 mr-1" />
                                                        저장
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setEditingProvider(null);
                                                    setNewKey('');
                                                    setError(null);
                                                }}
                                            >
                                                취소
                                            </Button>
                                        </div>
                                    </div>
                                ) : keyStatus?.hasKey ? (
                                    <div className="flex items-center justify-between">
                                        <code className="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded">
                                            {keyStatus.masked}
                                        </code>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setEditingProvider(provider.id);
                                                    setNewKey('');
                                                }}
                                            >
                                                변경
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDeleteKey(provider.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setEditingProvider(provider.id);
                                            setNewKey('');
                                        }}
                                    >
                                        <Key className="w-4 h-4 mr-2" />
                                        API 키 등록
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 비용 안내 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-amber-800">비용 안내</h4>
                        <p className="text-sm text-amber-700 mt-1">
                            BYOK 사용 시 API 비용은 각 제공자에게 직접 청구됩니다.
                            일반적으로 하루 평균 20~50회 대화 시 월 $1~5 정도입니다.
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-white rounded-lg p-2 text-center">
                                <div className="font-medium text-gray-900">Gemini</div>
                                <div className="text-gray-500">무료 티어 제공</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 text-center">
                                <div className="font-medium text-gray-900">GPT-4o-mini</div>
                                <div className="text-gray-500">~$0.15/1M 토큰</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 text-center">
                                <div className="font-medium text-gray-900">Claude Haiku</div>
                                <div className="text-gray-500">~$0.25/1M 토큰</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

// KaTeX options for better math rendering
const katexOptions = {
    strict: false,
    trust: true,
    throwOnError: false,
    errorColor: '#cc0000',
    macros: {
        "\\f": "#1f(#2)"
    }
};

interface Section {
    title: string;
    emoji: string;
    content: string;
}

interface AccordionContentProps {
    content: string;
}

// Parse content into sections based on ## headings
function parseSections(content: string): Section[] {
    const lines = content.split('\n');
    const sections: Section[] = [];
    let currentSection: Section | null = null;

    for (const line of lines) {
        // Match ## Title pattern (GPT generates this format)
        const headingMatch = line.match(/^##\s+(.+)$/);

        if (headingMatch) {
            // Save previous section if exists
            if (currentSection) {
                sections.push(currentSection);
            }

            const fullTitle = headingMatch[1].trim();

            // Try to extract emoji from title (e.g., "🔸 Title" or just "Title")
            const emojiMatch = fullTitle.match(/^([\p{Emoji}])\s+(.+)$/u);

            // Start new section
            currentSection = {
                emoji: emojiMatch ? emojiMatch[1] : '📄',
                title: emojiMatch ? emojiMatch[2].trim() : fullTitle,
                content: ''
            };
        } else if (currentSection) {
            // Add line to current section
            currentSection.content += line + '\n';
        }
    }

    // Add last section
    if (currentSection) {
        sections.push(currentSection);
    }

    return sections;
}

export function AccordionContent({ content }: AccordionContentProps) {
    // Split content by "한걸음 더!" sections
    const parts = content.split(/(###\s*💡\s*한걸음\s*더![\s\S]*?)(?=###\s*💡\s*한걸음\s*더!|$)/);

    return (
        <div className="text-sm leading-[1.8] text-gray-300 markdown-content">
            {parts.map((part, index) => {
                // Check if this part is a "한걸음 더!" section
                if (part.match(/###\s*💡\s*한걸음\s*더!/)) {
                    return (
                        <div key={index} className="my-6 p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-indigo-500/10 border border-cyan-500/30 backdrop-blur-md shadow-xl relative overflow-hidden">
                            {/* Glassmorphism effect */}
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 via-blue-400/5 to-transparent pointer-events-none" />
                            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 blur-2xl opacity-60 pointer-events-none" />

                            {/* Content */}
                            <div className="relative">
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath, remarkGfm]}
                                    rehypePlugins={[[rehypeKatex, katexOptions], rehypeRaw]}
                                    components={{
                                        ...getMarkdownComponents(),
                                        h3: ({ node, ...props }: any) => (
                                            <h3 className="text-base font-bold mb-4 text-cyan-300 flex items-center gap-2" {...props} />
                                        ),
                                        p: ({ node, ...props }: any) => (
                                            <p className="mb-3 last:mb-0 leading-[1.8] text-cyan-50" {...props} />
                                        ),
                                    }}
                                >
                                    {part}
                                </ReactMarkdown>
                            </div>
                        </div>
                    );
                }

                // Regular content
                return (
                    <ReactMarkdown
                        key={index}
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[rehypeRaw, [rehypeKatex, katexOptions]]}
                        components={getMarkdownComponents()}
                    >
                        {part}
                    </ReactMarkdown>
                );
            })}
        </div>
    );
}

// Shared markdown components
function getMarkdownComponents() {
    return {
        // <mark> 태그 -> 시안/청록색 하이라이트 (가장 중요한 강조)
        mark: ({ node, ...props }: any) => (
            <mark className="bg-cyan-500/25 text-cyan-100 px-1.5 py-0.5 rounded font-bold border border-cyan-400/30" {...props} />
        ),
        // **단어 강조** -> 퍼플 하이라이트
        strong: ({ node, ...props }: any) => (
            <span className="bg-purple-500/20 text-purple-200 px-1 rounded font-semibold" {...props} />
        ),
        // *문장 강조* -> 파란색 강조
        em: ({ node, ...props }: any) => (
            <span className="bg-blue-500/20 text-blue-200 px-1 rounded font-medium not-italic" {...props} />
        ),
        // > 인용구 -> Note/Explanation 박스
        blockquote: ({ node, ...props }: any) => {
            // Check if this is an Explanation or Note box
            const text = node?.children?.[0]?.children?.[0]?.value || '';
            const isExplanation = text.includes('💡') || text.includes('Explanation');

            if (isExplanation) {
                // Explanation 박스 - 라이트 블루 배경
                return (
                    <div className="my-4 p-5 rounded-xl bg-blue-500/10 border border-blue-400/30 backdrop-blur-sm relative overflow-hidden blockquote-content" {...props}>
                        <div className="relative text-blue-100 leading-[1.8]">{props.children}</div>
                    </div>
                );
            } else {
                // Note 박스 - 시안 블루 유리 글래스
                return (
                    <div className="my-4 p-5 rounded-xl bg-gradient-to-br from-purple-500/15 via-violet-500/10 to-purple-600/15 border border-purple-400/30 backdrop-blur-md shadow-[0_8px_32px_rgba(168,85,247,0.25)] relative overflow-hidden blockquote-content" {...props}>
                        {/* Glass effect overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                        {/* Glow effect */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/20 to-violet-500/20 blur-xl opacity-50 pointer-events-none" />
                        {/* Content */}
                        <div className="relative text-purple-50 font-medium leading-[1.8]">{props.children}</div>
                    </div>
                );
            }
        },
        // 문단
        p: ({ node, ...props }: any) => (
            <p className="mb-4 last:mb-0 leading-[1.8]" {...props} />
        ),
        // 리스트
        ul: ({ node, ...props }: any) => (
            <ul className="list-disc list-inside space-y-2 mb-4 ml-2" {...props} />
        ),
        ol: ({ node, ...props }: any) => (
            <ol className="list-decimal list-inside space-y-2 mb-4 ml-2" {...props} />
        ),
        li: ({ node, ...props }: any) => (
            <li className="text-gray-300 leading-[1.8] pl-1" {...props} />
        ),
        // 코드 블록 -> 중요 개념 카드
        code: ({ node, inline, ...props }: any) => {
            if (inline) {
                // 인라인 코드 -> 주황색 강조
                return (
                    <code className="bg-orange-500/20 text-orange-200 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                );
            } else {
                // 블록 코드 -> 중요 개념 카드
                return (
                    <div className="my-4 p-5 rounded-xl bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-500/20 backdrop-blur-sm shadow-lg">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            <code className="text-green-100 font-medium leading-[1.8] block" {...props} />
                        </div>
                    </div>
                );
            }
        },
        // h4 -> 소제목
        h4: ({ node, ...props }: any) => (
            <h4 className="text-sm font-semibold mt-5 mb-3 text-white" {...props} />
        ),
        // h2는 이미 섹션 헤더로 처리되므로 제거
        h2: () => null,
        // h3 -> 중간 제목
        h3: ({ node, ...props }: any) => (
            <h3 className="text-base font-bold mt-6 mb-4 text-white" {...props} />
        ),
        // Table support
        table: ({ node, ...props }: any) => (
            <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse" {...props} />
            </div>
        ),
        thead: ({ node, ...props }: any) => (
            <thead className="bg-white/5" {...props} />
        ),
        tbody: ({ node, ...props }: any) => (
            <tbody {...props} />
        ),
        tr: ({ node, ...props }: any) => (
            <tr className="border-b border-white/10" {...props} />
        ),
        th: ({ node, ...props }: any) => (
            <th className="px-4 py-3 text-left text-sm font-semibold text-primary border-r border-white/10 last:border-r-0" {...props} />
        ),
        td: ({ node, ...props }: any) => (
            <td className="px-4 py-3 text-sm text-gray-300 border-r border-white/10 last:border-r-0" {...props} />
        ),
    };
}

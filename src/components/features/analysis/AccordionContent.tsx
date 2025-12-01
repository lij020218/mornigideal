"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface Section {
    title: string;
    emoji: string;
    content: string;
}

interface AccordionContentProps {
    content: string;
}

// Parse content into sections based on ### headings
function parseSections(content: string): Section[] {
    const lines = content.split('\n');
    const sections: Section[] = [];
    let currentSection: Section | null = null;

    for (const line of lines) {
        // Match ### 🔸 Title pattern
        const headingMatch = line.match(/^###\s+([\p{Emoji}])\s+(.+)$/u);

        if (headingMatch) {
            // Save previous section if exists
            if (currentSection) {
                sections.push(currentSection);
            }

            // Start new section
            currentSection = {
                emoji: headingMatch[1],
                title: headingMatch[2].trim(),
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
    const sections = parseSections(content);
    const [openSections, setOpenSections] = useState<Set<number>>(new Set([0])); // First section open by default

    const toggleSection = (index: number) => {
        const newOpenSections = new Set(openSections);
        if (newOpenSections.has(index)) {
            newOpenSections.delete(index);
        } else {
            newOpenSections.add(index);
        }
        setOpenSections(newOpenSections);
    };

    // If no sections parsed (content doesn't have ### headings), render normally
    if (sections.length === 0) {
        return (
            <div className="text-sm leading-[1.8] text-gray-300 markdown-content">
                <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={getMarkdownComponents()}
                >
                    {content}
                </ReactMarkdown>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {sections.map((section, index) => {
                const isOpen = openSections.has(index);

                return (
                    <div key={index} className="border border-white/10 rounded-xl overflow-hidden bg-white/5 backdrop-blur-sm">
                        {/* Header */}
                        <button
                            onClick={() => toggleSection(index)}
                            className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{section.emoji}</span>
                                <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors">
                                    {section.title}
                                </h3>
                            </div>
                            <ChevronDown
                                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                                    isOpen ? 'rotate-180' : ''
                                }`}
                            />
                        </button>

                        {/* Content */}
                        <AnimatePresence initial={false}>
                            {isOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-5 pb-5 pt-2 text-sm leading-[1.8] text-gray-300 markdown-content">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                            components={getMarkdownComponents()}
                                        >
                                            {section.content.trim()}
                                        </ReactMarkdown>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
}

// Shared markdown components
function getMarkdownComponents() {
    return {
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
                    <div className="my-4 p-5 rounded-xl bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-cyan-600/15 border border-cyan-400/30 backdrop-blur-md shadow-[0_8px_32px_rgba(6,182,212,0.25)] relative overflow-hidden blockquote-content" {...props}>
                        {/* Glass effect overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                        {/* Glow effect */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-xl opacity-50 pointer-events-none" />
                        {/* Content */}
                        <div className="relative text-cyan-50 font-medium leading-[1.8]">{props.children}</div>
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
        // h3는 이미 섹션 헤더로 처리되므로 제거
        h3: () => null,
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

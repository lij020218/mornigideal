/**
 * PDF Structure Parser
 * Automatically extracts structured information from PDF text without using LLM
 * - Titles and headings
 * - Sections and subsections
 * - Formulas and equations
 * - Examples and case studies
 * - Key terms and definitions
 * - Tables and lists
 */

export interface ParsedSection {
  type: 'title' | 'heading' | 'paragraph' | 'formula' | 'example' | 'definition' | 'list' | 'table';
  level?: number; // For headings: 1, 2, 3, etc.
  content: string;
  metadata?: {
    isKeyPoint?: boolean;
    hasFormula?: boolean;
    isExample?: boolean;
    lineNumber?: number;
  };
}

export interface StructuredPDF {
  title?: string;
  sections: ParsedSection[];
  keyTerms: string[];
  formulas: string[];
  examples: ParsedSection[];
  summary: {
    totalSections: number;
    hasFormulas: boolean;
    hasExamples: boolean;
    estimatedReadingTime: number;
  };
}

/**
 * Parse PDF text into structured sections
 */
export function parsePDFStructure(text: string): StructuredPDF {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const keyTerms: string[] = [];
  const formulas: string[] = [];
  const examples: ParsedSection[] = [];

  let lineNumber = 0;
  let currentSection: ParsedSection | null = null;
  const mergedSections: ParsedSection[] = [];

  for (const line of lines) {
    lineNumber++;

    // 1. Detect titles (ALL CAPS, or ending with specific patterns)
    if (isTitle(line)) {
      if (currentSection) mergedSections.push(currentSection);
      currentSection = {
        type: 'title',
        level: 1,
        content: line,
        metadata: { lineNumber }
      };
      continue;
    }

    // 2. Detect headings (numbered sections, or capitalized with keywords)
    const headingLevel = detectHeadingLevel(line);
    if (headingLevel > 0) {
      if (currentSection) mergedSections.push(currentSection);
      currentSection = {
        type: 'heading',
        level: headingLevel,
        content: line,
        metadata: { lineNumber }
      };
      continue;
    }

    // If we have a current section, append content to it
    if (currentSection) {
      // 3. Detect formulas
      if (isFormula(line)) {
        formulas.push(line);
      }

      // 4. Detect examples
      if (isExampleStart(line)) {
        const example: ParsedSection = {
          type: 'example',
          content: line,
          metadata: { isExample: true, lineNumber }
        };
        examples.push(example);
      }

      // 5. Detect definitions
      if (isDefinition(line)) {
        const term = extractTerm(line);
        if (term) keyTerms.push(term);
      }

      // Append all content to current section (merge)
      if (line.length > 10) {
        if (!currentSection.metadata) currentSection.metadata = {};
        const existingContent = (currentSection.metadata as any).fullContent || '';
        (currentSection.metadata as any).fullContent = existingContent + line + ' ';
      }
    }
  }

  if (currentSection) mergedSections.push(currentSection);

  return {
    title: mergedSections.find(s => s.type === 'title')?.content,
    sections: mergedSections,
    keyTerms: [...new Set(keyTerms)],
    formulas,
    examples,
    summary: {
      totalSections: mergedSections.filter(s => s.type === 'heading').length,
      hasFormulas: formulas.length > 0,
      hasExamples: examples.length > 0,
      estimatedReadingTime: Math.ceil(text.split(' ').length / 200) // 200 words per minute
    }
  };
}

/**
 * Check if line is a title
 */
function isTitle(line: string): boolean {
  // ALL CAPS (at least 60% uppercase)
  const uppercaseRatio = (line.match(/[A-Z]/g) || []).length / line.length;
  if (uppercaseRatio > 0.6 && line.length > 10 && line.length < 100) {
    return true;
  }

  // Common title patterns
  const titlePatterns = [
    /^Chapter \d+/i,
    /^Part \d+/i,
    /^Section \d+/i,
    /^\d+장/,
    /^제\d+장/,
  ];

  return titlePatterns.some(pattern => pattern.test(line));
}

/**
 * Detect heading level (1-4)
 */
function detectHeadingLevel(line: string): number {
  // Pattern: "1.2.3 Title" -> level 3
  const numberedMatch = line.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
  if (numberedMatch) {
    const depth = numberedMatch[1].split('.').length;
    return Math.min(depth, 4);
  }

  // Pattern: "### Title" (Markdown-style)
  const markdownMatch = line.match(/^(#{1,4})\s+(.+)$/);
  if (markdownMatch) {
    return markdownMatch[1].length;
  }

  // Korean numbered sections
  if (/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(line)) return 2;
  if (/^[가-힣]{1,3}\.\s/.test(line) && line.length < 50) return 3;

  // Capitalized short lines (likely headings)
  if (line.length < 60 && /^[A-Z]/.test(line) && !line.endsWith('.')) {
    const words = line.split(' ');
    const capitalizedWords = words.filter(w => /^[A-Z]/.test(w)).length;
    if (capitalizedWords >= words.length * 0.5) {
      return 2;
    }
  }

  return 0;
}

/**
 * Check if line is a formula
 */
function isFormula(line: string): boolean {
  // LaTeX patterns
  if (line.includes('\\') && /\\[a-z]+/.test(line)) return true;
  if (line.includes('$$') || line.includes('$')) return true;

  // Math symbols and patterns
  const mathPatterns = [
    /[∫∑∏√±≤≥≠≈∞]/,
    /[α-ωΑ-Ω]/,
    /\^[\d+\-*\/()]/,
    /_{[\w+]}/,
    /=\s*[\d\w]+\s*[+\-*/]/,
  ];

  const hasMultipleMathSymbols = mathPatterns.filter(p => p.test(line)).length >= 2;
  if (hasMultipleMathSymbols) return true;

  // Equation-like patterns
  if (/^[A-Za-z]\s*=\s*/.test(line) && line.length < 100) return true;

  return false;
}

/**
 * Check if line starts an example
 */
function isExampleStart(line: string): boolean {
  const examplePatterns = [
    /^Example\s*\d*:/i,
    /^예시\s*\d*:/,
    /^Example\s*\d*\./i,
    /^Case Study:/i,
    /^실제 사례:/,
    /^For example,?/i,
    /^예를 들어,?/,
    /^Consider the following/i,
  ];

  return examplePatterns.some(pattern => pattern.test(line));
}

/**
 * Check if line is a definition
 */
function isDefinition(line: string): boolean {
  // Pattern: "Term: Definition"
  if (/^[A-Z][a-zA-Z\s]{2,30}:\s+[A-Z]/.test(line)) return true;

  // Pattern: "Term - Definition"
  if (/^[A-Z][a-zA-Z\s]{2,30}\s+-\s+[A-Z]/.test(line)) return true;

  // Pattern: "Term is/means/refers to..."
  if (/^[A-Z][a-zA-Z\s]{2,30}\s+(is|means|refers to)\s+/.test(line)) return true;

  return false;
}

/**
 * Extract term from definition line
 */
function extractTerm(line: string): string | null {
  const colonMatch = line.match(/^([A-Z][a-zA-Z\s]{2,30}):/);
  if (colonMatch) return colonMatch[1].trim();

  const dashMatch = line.match(/^([A-Z][a-zA-Z\s]{2,30})\s+-/);
  if (dashMatch) return dashMatch[1].trim();

  const isMatch = line.match(/^([A-Z][a-zA-Z\s]{2,30})\s+(?:is|means|refers to)/);
  if (isMatch) return isMatch[1].trim();

  return null;
}

/**
 * Check if line is part of a list
 */
function isList(line: string): boolean {
  // Bullet points
  if (/^[•·○●▪▫-]\s/.test(line)) return true;

  // Numbered lists
  if (/^\d+[.)]\s/.test(line)) return true;

  // Lettered lists
  if (/^[a-z][.)]\s/.test(line)) return true;

  return false;
}

/**
 * Check if content is a key point
 */
function isKeyPoint(content: string): boolean {
  const keywordPatterns = [
    /important/i,
    /key point/i,
    /핵심/,
    /중요/,
    /주요/,
    /critical/i,
    /essential/i,
    /fundamental/i,
  ];

  return keywordPatterns.some(pattern => pattern.test(content));
}

/**
 * Check if content contains formula symbols
 */
function containsFormulaSymbols(content: string): boolean {
  return /[=+\-*/^()∫∑∏√±≤≥≠≈∞α-ωΑ-Ω]/.test(content);
}

/**
 * Create a lightweight summary for LLM processing
 * Only includes essential information, reducing token count by 70-80%
 */
export function createLightweightSummary(structured: StructuredPDF): string {
  const parts: string[] = [];

  // Title
  if (structured.title) {
    parts.push(`# ${structured.title}\n`);
  }

  // IMPORTANT: Sample evenly across ALL sections to preserve full document coverage
  // Get all level 1-2 headings in original order
  const allHeadingsInOrder = structured.sections
    .filter(s => (s.type === 'heading' || s.type === 'title') && (s.level || 1) <= 2);

  // Sample evenly: take every Nth heading to cover entire document uniformly
  const targetCount = 20;
  const stepSize = Math.max(1, Math.floor(allHeadingsInOrder.length / targetCount));

  const allHeadings: ParsedSection[] = [];
  for (let i = 0; i < allHeadingsInOrder.length && allHeadings.length < targetCount; i += stepSize) {
    allHeadings.push(allHeadingsInOrder[i]);
  }

  allHeadings.forEach(heading => {
    parts.push(`## ${heading.content}`);

    // Get content from metadata (merged during parsing)
    const fullContent = (heading.metadata as any)?.fullContent || '';

    if (fullContent) {
      // Take first 300 chars (roughly 50 words) - keeps key information
      const content = fullContent.substring(0, 300).trim();
      parts.push(content);
    } else {
      // Fallback: find next paragraph
      const headingIndex = structured.sections.indexOf(heading);
      const nextParagraph = structured.sections
        .slice(headingIndex + 1, headingIndex + 5)
        .find(s => s.type === 'paragraph');

      if (nextParagraph) {
        const content = nextParagraph.content.substring(0, 300).trim();
        parts.push(content);
      }
    }
    parts.push('');
  });

  // Formulas (keep more, don't truncate too aggressively)
  if (structured.formulas.length > 0) {
    parts.push('\n### Formulas');
    structured.formulas.slice(0, 12).forEach(f => parts.push(`- ${f.substring(0, 150)}`));
  }

  // Examples (keep more)
  if (structured.examples.length > 0) {
    parts.push('\n### Examples');
    structured.examples.slice(0, 6).forEach(e => {
      const title = e.content.split('\n')[0].substring(0, 100);
      parts.push(`- ${title}`);
    });
  }

  // Key terms (keep more)
  if (structured.keyTerms.length > 0) {
    parts.push('\n### Key Terms');
    parts.push(structured.keyTerms.slice(0, 15).join(', '));
  }

  return parts.join('\n');
}

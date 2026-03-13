
// @ts-nocheck
export default {
  metadata: {
    name: 'markdown-syntax',
    description: 'Basic Markdown syntax highlighting'
  },
  setup: (api: any) => {
    api.registerLineRenderer({
      name: 'markdown-highlighter',
      priority: 20, // Higher priority than default
      render: ({ lineIndex, lineContent, leftCol, viewportWidth, visualStart, mode, cursor, currentFilePath }: any) => {
        const path = typeof currentFilePath === 'function' ? currentFilePath() : currentFilePath;
        if (!path || !path.endsWith('.md')) return null;

        const content = typeof lineContent === 'function' ? lineContent() : lineContent;
        const startCol = typeof leftCol === 'function' ? leftCol() : leftCol;
        const width = typeof viewportWidth === 'function' ? viewportWidth() : viewportWidth;
        const idx = typeof lineIndex === 'function' ? lineIndex() : lineIndex;

        // Basic regex for markdown
        const headerRegex = /^(#{1,6}\s+.*)$/;
        const listRegex = /^(\s*[*+-]\s+.*)$/;
        const numListRegex = /^(\s*\d+\.\s+.*)$/;
        const quoteRegex = /^(\s*>.*)$/;
        const codeRegex = /^(\s*`.*`\s*)$/;

        let color = '#ffffff';
        if (headerRegex.test(content)) {
          color = '#569cd6'; // Blue for headers
        } else if (listRegex.test(content) || numListRegex.test(content)) {
          color = '#ce9178'; // Orange/Salmon for lists
        } else if (quoteRegex.test(content)) {
          color = '#6a9955'; // Green for quotes
        } else if (codeRegex.test(content)) {
          color = '#b5cea8'; // Light green for inline code
        } else if (content.startsWith('```') || content.endsWith('```')) {
          color = '#808080'; // Gray for code blocks
        }

        const visibleContent = content.slice(startCol, startCol + width);
        
        // Handle Visual Mode highlighting
        const start = typeof visualStart === 'function' ? visualStart() : visualStart;
        const currentMode = typeof mode === 'function' ? mode() : mode;
        const currentCursor = typeof cursor === 'function' ? cursor() : cursor;

        if (start && currentMode === 'Visual') {
          let s = start;
          let e = currentCursor;
          if (s.y > e.y || (s.y === e.y && s.x > e.x)) {
            [s, e] = [e, s];
          }

          if (idx >= s.y && idx <= e.y) {
            const highlightStart = (idx === s.y) ? s.x : 0;
            let highlightEnd = (idx === e.y) ? e.x : content.length;
            highlightEnd = Math.min(content.length, highlightEnd + 1);

            const tokens = [];
            const tokenStart = startCol;
            const tokenEnd = startCol + visibleContent.length;

            const splitPoints = [highlightStart, highlightEnd].filter(p => p > tokenStart && p < tokenEnd);
            let lastP = tokenStart;
            for (const p of [...splitPoints, tokenEnd]) {
              const partContent = content.slice(lastP, p);
              if (partContent.length > 0) {
                const isHighlighted = lastP >= highlightStart && lastP < highlightEnd;
                tokens.push({
                  x: lastP - startCol,
                  content: partContent,
                  color: color,
                  bg_color: isHighlighted ? "#004b72" : undefined
                });
              }
              lastP = p;
            }
            return tokens.map(t => (
              <tui-text x={t.x} y={0} content={t.content} color={t.color} bg_color={t.bg_color} />
            ));
          }
        }

        return (
          <tui-text x={0} y={0} content={visibleContent} color={color} />
        );
      }
    });
  }
};

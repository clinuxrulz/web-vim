
export default {
  metadata: {
    name: 'fuzzy-finder',
    description: 'Fuzzy find files and grep contents',
    author: 'Net-Vim Team'
  },
  setup: (api: any) => {
    const walk = async (path: string, allFiles: string[]) => {
      // Skip common large/irrelevant directories
      if (path.includes('.git') || path.includes('node_modules') || path.includes('dist') || path.includes('build')) return;
      
      try {
        const entries = await api.fs.listDirectory(path);
        for (const entry of entries) {
          const isDir = entry.endsWith('/');
          const name = isDir ? entry.slice(0, -1) : entry;
          const fullPath = path ? (path.endsWith('/') ? path + name : path + '/' + name) : name;
          
          if (isDir) {
            await walk(fullPath, allFiles);
          } else {
            allFiles.push(fullPath);
          }
        }
      } catch (e) {
        api.log('FuzzyFinder: Walk error at ' + path + ': ' + e.message);
      }
    };

    api.registerCommand('fuzzyFiles', async () => {
      api.log('FuzzyFinder: Searching files...');
      const allFiles: string[] = [];
      await walk('', allFiles);
      
      api.showPicker({
        placeholder: 'Find Files',
        items: allFiles.map(f => ({ label: f, id: f })),
        onSelect: (item) => {
          api.executeCommand(`e ${item.id}`);
        }
      });
    });

    api.registerCommand('liveGrep', async () => {
      api.log('FuzzyFinder: Live Grep...');
      const allFiles: string[] = [];
      await walk('', allFiles);

      api.showPicker({
        placeholder: 'Live Grep',
        items: async (query) => {
          if (!query || query.length < 2) return [];
          
          const results: any[] = [];
          const q = query.toLowerCase();
          
          // Limit to first 100 results for performance
          for (const file of allFiles) {
            if (results.length >= 100) break;
            
            // Skip binary or large files if we had a way to check, but for now just try
            try {
              const content = await api.fs.readFile(file);
              if (!content) continue;
              
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(q)) {
                  results.push({
                    label: `${file}:${i + 1}`,
                    detail: lines[i].trim(),
                    id: `${file}:${i + 1}`,
                    file,
                    line: i
                  });
                  if (results.length >= 100) break;
                }
              }
            } catch (e) {}
          }
          return results;
        },
        onSelect: (item: any) => {
          api.executeCommand(`e ${item.file}`);
          // Need a way to set cursor after opening
          setTimeout(() => {
            api.setCursor(0, item.line);
          }, 100);
        }
      });
    });
    
    api.log('FuzzyFinder plugin initialized');
  }
};

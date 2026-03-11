/**
 * Utility to load a script from a URL
 */
export async function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      if (scripts[i].src === url) {
        resolve();
        return;
      }
    }

    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = (err) => {
      console.error(`Failed to load script: ${url}`, err);
      reject(err);
    };
    document.head.appendChild(script);
  });
}

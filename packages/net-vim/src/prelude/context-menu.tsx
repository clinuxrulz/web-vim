
export default {
  metadata: {
    name: "context-menu",
    description: "Core context menu functionality"
  },
  setup: (api: any) => {
    api.registerContextMenuItem({
      label: "Paste",
      priority: 100,
      action: async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            api.insertText(text);
          }
        } catch (err: any) {
          api.log("Paste failed: " + err.message);
        }
      }
    });
  }
};

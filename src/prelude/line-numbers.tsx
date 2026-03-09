
export default {
  metadata: {
    name: "line-numbers",
    author: "Web-Vim Team",
    version: "1.0.0",
    description: "Provides line numbers in the gutter"
  },
  setup: (api: any) => {
    api.log("Setting up line-numbers plugin...");
    api.registerGutter({
      name: "line-numbers",
      width: 4,
      priority: 100,
      render: ({ lineIndex, isCursorLine }: any) => {
        const getVal = (val: any) => (typeof val === "function" ? val() : val);
        const num = () => (getVal(lineIndex) + 1).toString().padStart(3, " ");
        return (
          <tui-text 
            content={num() + " "} 
            color={getVal(isCursorLine) ? "#ffffff" : "#888888"} 
          />
        );
      }
    });
    api.log("Line-numbers gutter registered");
  }
};
